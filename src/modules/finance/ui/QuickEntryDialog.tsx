import { useEffect, useMemo, useState } from 'react';
import { Check, CopyPlus, Eraser } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { getSupabaseClient } from '../../../shared/infrastructure/supabase/client';
import type { CreditCard } from '../domain/cards';
import type { FinancialAccount } from '../domain/registries';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';

type EntryType = 'expense' | 'income';
type LaunchType = 'single' | 'installment' | 'recurring';
type PaymentMethod = 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other';
type InlineRegistry = 'costCenter' | 'category';
type OwnedAccount = FinancialAccount & { ownerLabel: string };
type OwnedCard = CreditCard & { ownerLabel: string };
type SmartTemplate = {
  description: string;
  companyId: string;
  entryType: EntryType;
  categoryId: string;
  costCenterId: string;
  accountRef: string;
  paymentMethod: PaymentMethod;
  cardRef: string;
  occurredOn: string;
};

interface QuickEntryDialogProps {
  open: boolean;
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
  allCompaniesMode?: boolean;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;
const idempotencyKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const digitsOnly = (value: string) => value.replace(/\D/g, '').slice(0, 14);
const amountFromDigits = (digits: string) => Number(digits || '0') / 100;
const formatMoneyDigits = (digits: string) => digits
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountFromDigits(digits))
  : '';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
const paymentRef = (companyId: string, resourceId: string) => `${companyId}::${resourceId}`;

function parsePaymentRef(value: string): { companyId: string; resourceId: string } | null {
  const separator = value.indexOf('::');
  if (separator <= 0) return null;
  return { companyId: value.slice(0, separator), resourceId: value.slice(separator + 2) };
}

function companyName(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR')) return 'PR';
  if (raw.includes('CR')) return 'CR';
  return company.tradeName ?? company.legalName;
}

function companySubtitle(company: CompanySummary): string {
  const short = companyName(company);
  if (short === 'CR') return 'CR Engenharia';
  if (short === 'PR') return 'PR Instalações';
  if (short === 'Pessoal') return 'Uso pessoal';
  return company.tradeName ?? company.legalName;
}

const COST_CENTER_ORDER = ['Admin', 'Blaze', 'CR', 'Pessoal', 'PR', 'Sartori'] as const;

function costCenterLabel(code: string | null, name: string): string | null {
  const raw = `${code ?? ''} ${name}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('ADMIN')) return 'Admin';
  if (raw.includes('BLAZE')) return 'Blaze';
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('SARTORI')) return 'Sartori';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  return null;
}

function canonicalCostCenters<T extends { id: string; code: string | null; name: string }>(rows: readonly T[]) {
  const chosen = new Map<string, T>();
  const extras: T[] = [];
  for (const item of rows) {
    const label = costCenterLabel(item.code, item.name);
    if (!label) {
      extras.push(item);
      continue;
    }
    const current = chosen.get(label);
    const currentHistoric = current ? /HIST/i.test(`${current.code ?? ''} ${current.name}`) : true;
    const candidateHistoric = /HIST/i.test(`${item.code ?? ''} ${item.name}`);
    if (!current || (currentHistoric && !candidateHistoric)) chosen.set(label, item);
  }
  return [
    ...COST_CENTER_ORDER.flatMap((label) => chosen.get(label) ? [{ item: chosen.get(label)!, label }] : []),
    ...extras.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((item) => ({ item, label: item.name })),
  ];
}

function recurrenceEnd(start: string, count: number): string {
  const date = new Date(`${start}T12:00:00`);
  date.setMonth(date.getMonth() + Math.max(0, count - 1));
  return date.toISOString().slice(0, 10);
}

export function QuickEntryDialog({ open, companies, initialCompanyId = '', allCompaniesMode = false, onClose }: QuickEntryDialogProps) {
  const [companyId, setCompanyId] = useState(initialCompanyId || companies[0]?.id || '');
  const [moreOptions, setMoreOptions] = useState(false);
  const [inlineRegistry, setInlineRegistry] = useState<InlineRegistry | null>(null);
  const [newRegistryName, setNewRegistryName] = useState('');
  const [templates, setTemplates] = useState<readonly SmartTemplate[]>([]);
  const [paymentAccounts, setPaymentAccounts] = useState<readonly OwnedAccount[]>([]);
  const [paymentCards, setPaymentCards] = useState<readonly OwnedCard[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [localSuccess, setLocalSuccess] = useState<string | null>(null);
  const [form, setForm] = useState({
    entryType: 'expense' as EntryType,
    date: today(),
    description: '',
    amountDigits: '',
    paymentMethod: 'pix' as PaymentMethod,
    launchType: 'single' as LaunchType,
    installmentCount: '2',
    recurrenceCount: '12',
    accountRef: '',
    cardRef: '',
    categoryId: '',
    costCenterId: '',
    counterparty: '',
    notes: '',
    includeInBudget: false,
  });

  useEffect(() => {
    if (!open) return;
    setCompanyId(initialCompanyId || companies[0]?.id || '');
    setMoreOptions(false);
    setInlineRegistry(null);
    setNewRegistryName('');
    setLocalError(null);
    setLocalSuccess(null);
    setForm({
      entryType: 'expense', date: today(), description: '', amountDigits: '', paymentMethod: 'pix', launchType: 'single',
      installmentCount: '2', recurrenceCount: '12', accountRef: '', cardRef: '', categoryId: '', costCenterId: '',
      counterparty: '', notes: '', includeInBudget: false,
    });
  }, [companies, initialCompanyId, open]);

  const company = companies.find((item) => item.id === companyId) ?? companies[0];
  const scope = useMemo(() => ({ tenantId: company?.tenantId ?? '', companyId: company?.id ?? '' }), [company?.id, company?.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;
  const isCrIncome = Boolean(company && companyName(company) === 'CR' && form.entryType === 'income');

  useEffect(() => {
    if (!open || companies.length === 0) return;
    let cancelled = false;
    setPaymentLoading(true);
    void (async () => {
      const repositories = getFinanceRepositories();
      const sourceCompanies = allCompaniesMode ? companies : company ? [company] : [];
      const rows = await Promise.all(sourceCompanies.map(async (owner) => {
        const ownerScope = { tenantId: owner.tenantId, companyId: owner.id };
        const [accounts, cards] = await Promise.all([
          repositories.registries.listAccounts(ownerScope),
          repositories.cards.listCards(ownerScope),
        ]);
        return {
          accounts: accounts.filter((item) => item.status === 'active').map((item) => ({ ...item, ownerLabel: companyName(owner) })),
          cards: cards.filter((item) => item.status === 'active').map((item) => ({ ...item, ownerLabel: companyName(owner) })),
        };
      }));
      if (!cancelled) {
        setPaymentAccounts(rows.flatMap((item) => item.accounts));
        setPaymentCards(rows.flatMap((item) => item.cards));
        setPaymentLoading(false);
      }
    })().catch(() => {
      if (!cancelled) {
        setPaymentAccounts([]);
        setPaymentCards([]);
        setPaymentLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [allCompaniesMode, companies, company, open]);

  useEffect(() => {
    if (!open || companies.length === 0) return;
    let cancelled = false;
    void (async () => {
      const repositories = getFinanceRepositories();
      const entryLists = await Promise.all(companies.map(async (entryCompany) => {
        const rows = await repositories.entries.list({ tenantId: entryCompany.tenantId, companyId: entryCompany.id });
        return rows.map((row) => ({
          description: row.description,
          companyId: entryCompany.id,
          entryType: row.entryType,
          categoryId: row.categoryId,
          costCenterId: row.costCenterId ?? '',
          accountRef: row.plannedAccountId ? paymentRef(entryCompany.id, row.plannedAccountId) : '',
          paymentMethod: 'pix' as PaymentMethod,
          cardRef: '',
          occurredOn: row.dueDate,
        }));
      }));
      const cardTemplates: SmartTemplate[] = [];
      const tenantId = companies[0]?.tenantId;
      if (tenantId) {
        const { data } = await getSupabaseClient()
          .from('card_transactions')
          .select('company_id,expense_company_id,card_id,purchase_date,description,category_id,cost_center_id')
          .eq('tenant_id', tenantId)
          .order('purchase_date', { ascending: false })
          .limit(200);
        for (const row of data ?? []) {
          cardTemplates.push({
            description: String(row.description ?? ''),
            companyId: String(row.expense_company_id ?? row.company_id ?? ''),
            entryType: 'expense',
            categoryId: String(row.category_id ?? ''),
            costCenterId: row.cost_center_id ? String(row.cost_center_id) : '',
            accountRef: '', paymentMethod: 'credit',
            cardRef: paymentRef(String(row.company_id ?? ''), String(row.card_id ?? '')),
            occurredOn: String(row.purchase_date ?? ''),
          });
        }
      }
      if (!cancelled) setTemplates([...cardTemplates, ...entryLists.flat()].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn)));
    })().catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [companies, open]);

  const activeCostCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const categories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === form.entryType));
  const costCenters = canonicalCostCenters(activeCostCenters);
  const accountOptions = [{ value: '', label: 'Selecione' }, ...paymentAccounts.map((item) => ({ value: paymentRef(item.companyId, item.id), label: item.name }))];
  const cardOptions = [{ value: '', label: 'Selecione o cartão' }, ...paymentCards.map((item) => ({ value: paymentRef(item.companyId, item.id), label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Selecione' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Selecione' }, ...costCenters.map(({ item, label }) => ({ value: item.id, label }))];
  const paymentOptions = [
    { value: 'pix', label: 'Pix' }, { value: 'debit', label: 'Cartão de débito' },
    ...(form.entryType === 'expense' ? [{ value: 'credit', label: 'Cartão de crédito' }] : []),
    { value: 'cash', label: 'Dinheiro' }, { value: 'transfer', label: 'Transferência' },
    { value: 'boleto', label: 'Boleto' }, { value: 'other', label: 'Outro' },
  ];

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setPaymentMethod(value: PaymentMethod) {
    setForm((current) => ({
      ...current,
      paymentMethod: value,
      launchType: value === 'credit' && current.launchType === 'recurring' ? 'single' : current.launchType,
      accountRef: value === 'credit' ? '' : current.accountRef,
      cardRef: value === 'credit' ? current.cardRef : '',
    }));
  }

  function selectCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setForm((current) => ({
      ...current,
      categoryId: '',
      costCenterId: '',
      accountRef: allCompaniesMode ? current.accountRef : '',
      cardRef: allCompaniesMode ? current.cardRef : '',
      includeInBudget: false,
    }));
  }

  function smartFill(description: string) {
    const query = normalized(description);
    if (query.length < 3) {
      set('description', description);
      return;
    }
    const match = templates.find((item) =>
      (normalized(item.description) === query || normalized(item.description).includes(query)) &&
      (allCompaniesMode || item.companyId === companyId));
    if (!match) {
      set('description', description);
      return;
    }
    if (allCompaniesMode) setCompanyId(match.companyId);
    setForm((current) => ({
      ...current, description, entryType: match.entryType, categoryId: match.categoryId, costCenterId: match.costCenterId,
      accountRef: match.accountRef, paymentMethod: match.paymentMethod, cardRef: match.cardRef, launchType: 'single',
      includeInBudget: false,
    }));
  }

  function resetAfterSave(keepData: boolean) {
    setLocalSuccess(null);
    setForm((current) => keepData ? {
      ...current, date: today(), description: '', amountDigits: '', counterparty: '', notes: '', includeInBudget: false,
    } : {
      entryType: 'expense', date: today(), description: '', amountDigits: '', paymentMethod: 'pix', launchType: 'single',
      installmentCount: '2', recurrenceCount: '12', accountRef: '', cardRef: '', categoryId: '', costCenterId: '',
      counterparty: '', notes: '', includeInBudget: false,
    });
  }

  function clearForm() {
    operations.clearFeedback();
    setLocalError(null);
    setLocalSuccess(null);
    setMoreOptions(false);
    resetAfterSave(false);
  }

  async function createInlineRegistry(kind: InlineRegistry) {
    const name = newRegistryName.trim();
    if (!name || !company) return;
    operations.clearFeedback();
    setLocalError(null);
    try {
      if (kind === 'category') {
        const created = await operations.createCategory({ name, kind: form.entryType });
        await operations.loadReferences();
        set('categoryId', created.id);
      } else {
        const created = await operations.createCostCenter({ name, code: null });
        await operations.loadReferences();
        set('costCenterId', created.id);
      }
      setInlineRegistry(null);
      setNewRegistryName('');
    } catch (error) {
      setLocalError(error instanceof Error && error.message ? error.message : 'Não foi possível concluir o cadastro rápido.');
    }
  }

  async function launch(keepData: boolean) {
    operations.clearFeedback();
    setLocalError(null);
    setLocalSuccess(null);
    const amount = amountFromDigits(form.amountDigits);
    if (!company || !form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.categoryId) {
      setLocalError('Preencha descrição, valor e categoria.');
      return;
    }
    if (form.paymentMethod === 'credit' && (!form.cardRef || form.entryType !== 'expense')) {
      setLocalError('Selecione um cartão válido.');
      return;
    }
    setSubmitting(true);
    try {
      if (form.launchType === 'recurring') {
        const count = Math.max(1, Math.trunc(Number(form.recurrenceCount || '1')));
        await operations.createRecurrence({
          entryType: form.entryType, description: form.description.trim(), counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId, costCenterId: form.costCenterId || null, amount, frequency: 'monthly', intervalCount: 1,
          startDate: form.date, endDate: recurrenceEnd(form.date, count), notes: form.notes.trim() || null,
        });
      } else if (form.paymentMethod === 'credit') {
        const card = parsePaymentRef(form.cardRef);
        if (!card) throw new Error('Selecione um cartão válido.');
        const result = await getSupabaseClient().rpc('create_card_purchase_cross_company', {
          p_tenant_id: company.tenantId, p_card_company_id: card.companyId, p_expense_company_id: company.id,
          p_card_id: card.resourceId, p_purchase_date: form.date, p_description: form.description.trim(),
          p_counterparty_name: form.counterparty.trim() || null, p_category_id: form.categoryId,
          p_cost_center_id: form.costCenterId || null, p_total_amount: amount,
          p_installment_count: form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1,
          p_idempotency_key: idempotencyKey('quick-card-purchase'), p_notes: form.notes.trim() || null,
        });
        if (result.error) throw result.error;
        window.dispatchEvent(new Event('finance-card-order-changed'));
      } else {
        const created = await operations.createEntry({
          entryType: form.entryType, description: form.description.trim(), counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId, costCenterId: form.costCenterId || null, competenceMonth: monthStart(form.date),
          dueDate: form.date, amount,
          installmentCount: form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1,
          notes: form.notes.trim() || null,
        });
        const includeInBudget = isCrIncome ? form.includeInBudget : true;
        const budgetUpdate = await getSupabaseClient()
          .from('financial_entries')
          .update({ include_in_budget: includeInBudget })
          .eq('tenant_id', company.tenantId)
          .eq('company_id', company.id)
          .eq('id', created.entryId);
        if (budgetUpdate.error) throw budgetUpdate.error;
        const account = parsePaymentRef(form.accountRef);
        if (account) await getFinanceRepositories().entries.setPlannedAccount(scope, created.entryId, account.resourceId, account.companyId);
      }
      await operations.loadReferences();
      resetAfterSave(keepData);
      setLocalSuccess(keepData ? 'Lançamento concluído. Dados principais mantidos.' : 'Lançamento concluído.');
      if (!keepData) onClose();
    } catch (error) {
      setLocalError(error instanceof Error && error.message ? error.message : 'Não foi possível concluir o lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  const busy = operations.state.busy || paymentLoading || submitting;
  const footer = <div className="quick-entry__footer-actions">
    <Button className="quick-entry__footer-action quick-entry__footer-action--clear" variant="tertiary" disabled={busy} onClick={clearForm}><Eraser className="quick-entry__footer-icon" aria-hidden="true"/><span>Limpar</span></Button>
    <Button className="quick-entry__footer-action quick-entry__footer-action--keep" variant="secondary" disabled={busy} onClick={() => { void launch(true); }}><CopyPlus className="quick-entry__footer-icon" aria-hidden="true"/><span>Lançar e manter dados</span></Button>
    <Button className="quick-entry__footer-action quick-entry__footer-action--launch" loading={busy} loadingLabel="Lançando…" onClick={() => { void launch(false); }}><Check className="quick-entry__footer-icon" aria-hidden="true"/><span>Lançar</span></Button>
  </div>;

  return <Dialog open={open} title="Novo lançamento" description="Registre uma receita ou despesa" variant="quick-entry" onClose={onClose} onBack={onClose} loading={busy} footer={footer}>
    {!company ? <Feedback tone="danger" title="Empresa obrigatória" message="Selecione uma empresa para continuar." /> : !references && operations.state.busy ? <LoadingState label="Carregando dados do lançamento…" /> : <>
      {(localError ?? operations.state.errorMessage) && <Feedback tone="danger" title="Não foi possível lançar" message={localError ?? operations.state.errorMessage ?? ''} />}
      {(localSuccess ?? operations.state.successMessage) && <Feedback tone="success" title="Lançamento concluído" message={localSuccess ?? operations.state.successMessage ?? ''} />}
      <div className="quick-entry">
        <div className="quick-entry__hero">
          <div className="quick-entry__type-switch" role="group" aria-label="Tipo do lançamento">
            <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--expense${form.entryType === 'expense' ? ' is-selected' : ''}`} aria-pressed={form.entryType === 'expense'} onClick={() => set('entryType', 'expense')}>
              <span className="quick-entry__choice-check">{form.entryType === 'expense' ? '✓' : '○'}</span><span className="quick-entry__choice-icon">↓</span><span><strong>Despesa</strong><small>Saída de dinheiro</small></span>
            </Button>
            <Button variant="tertiary" className={`quick-entry__type-choice quick-entry__type-choice--income${form.entryType === 'income' ? ' is-selected' : ''}`} aria-pressed={form.entryType === 'income'} onClick={() => set('entryType', 'income')}>
              <span className="quick-entry__choice-check">{form.entryType === 'income' ? '✓' : '○'}</span><span className="quick-entry__choice-icon">↑</span><span><strong>Receita</strong><small>Entrada de dinheiro</small></span>
            </Button>
          </div>
        </div>

        <div className="quick-entry__form-card">
          <div className="quick-entry__two-col">
            <Input label="Data" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required />
            <Input label="Valor" inputMode="numeric" placeholder="R$ 0,00" value={formatMoneyDigits(form.amountDigits)} onChange={(event) => set('amountDigits', digitsOnly(event.target.value))} required />
          </div>
          <Input label="Descrição" placeholder="Ex.: Café da manhã" value={form.description} onChange={(event) => smartFill(event.target.value)} required />

          <div className="quick-entry__two-col">
            <div className="quick-entry__registry-field"><div className="quick-entry__registry-control">
              <Select label="Categoria" value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} options={categoryOptions} required />
              <Button className="quick-entry__add" aria-label="Adicionar categoria" onClick={() => { setInlineRegistry(inlineRegistry === 'category' ? null : 'category'); setNewRegistryName(''); }}>＋</Button>
            </div>{inlineRegistry === 'category' && <div className="quick-entry__registry-create"><Input label="Nova categoria" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('category'); }}>Adicionar</Button></div>}</div>
            <Input label={form.entryType === 'expense' ? 'Fornecedor' : 'Pagador / origem'} placeholder="Selecione / digite" value={form.counterparty} onChange={(event) => set('counterparty', event.target.value)} />
          </div>

          <div className="quick-entry__company-section">
            <strong className="quick-entry__section-label">▥ Empresa</strong>
            <div className="quick-entry__company-options">
              {companies.map((item) => {
                const selected = item.id === companyId;
                const short = companyName(item);
                return <Button key={item.id} variant="tertiary" className={`quick-entry__company-choice${selected ? ' is-selected' : ''}`} aria-pressed={selected} onClick={() => selectCompany(item.id)}>
                  <span className="quick-entry__company-check">{selected ? '✓' : short === 'Pessoal' ? '◎' : '▥'}</span>
                  <span><strong>{short}</strong><small>{companySubtitle(item)}</small></span>
                </Button>;
              })}
            </div>
          </div>

          <div className="quick-entry__registry-field"><div className="quick-entry__registry-control">
            <Select label="Obra / Centro de custo" value={form.costCenterId} onChange={(event) => set('costCenterId', event.target.value)} options={costCenterOptions} />
            <Button className="quick-entry__add" aria-label="Adicionar obra ou centro de custo" onClick={() => { setInlineRegistry(inlineRegistry === 'costCenter' ? null : 'costCenter'); setNewRegistryName(''); }}>＋</Button>
          </div>{inlineRegistry === 'costCenter' && <div className="quick-entry__registry-create"><Input label="Nova obra / centro de custo" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('costCenter'); }}>Adicionar</Button></div>}</div>

          <div className="quick-entry__two-col">
            <Select label="Forma de pagamento" value={form.paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} options={paymentOptions} />
            {form.paymentMethod === 'credit' ? <Select label="Cartão" value={form.cardRef} onChange={(event) => set('cardRef', event.target.value)} options={cardOptions} required /> : <Select label="Banco / Conta" value={form.accountRef} onChange={(event) => set('accountRef', event.target.value)} options={accountOptions} />}
          </div>
        </div>

        <div className="quick-entry__launch-section">
          <strong className="quick-entry__section-label">▱ Tipo de lançamento</strong>
          <div className="quick-entry__launch-options">
            <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'single' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'single'} onClick={() => set('launchType', 'single')}>
              <span className="quick-entry__launch-check">{form.launchType === 'single' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">▱</span><span><strong>Único</strong><small>À vista</small></span>
            </Button>
            <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'installment' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'installment'} onClick={() => set('launchType', 'installment')}>
              <span className="quick-entry__launch-check">{form.launchType === 'installment' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">▤</span><span><strong>Parcelado</strong><small>Várias parcelas</small></span>
            </Button>
            {form.paymentMethod !== 'credit' && <Button variant="tertiary" className={`quick-entry__launch-choice${form.launchType === 'recurring' ? ' is-selected' : ''}`} aria-pressed={form.launchType === 'recurring'} onClick={() => set('launchType', 'recurring')}>
              <span className="quick-entry__launch-check">{form.launchType === 'recurring' ? '✓' : '○'}</span><span className="quick-entry__launch-icon">⟳</span><span><strong>Recorrente</strong><small>Todo mês</small></span>
            </Button>}
          </div>
          {form.launchType === 'installment' && <Input label="Quantidade de parcelas" type="number" min="2" max="120" value={form.installmentCount} onChange={(event) => set('installmentCount', event.target.value)} required />}
          {form.launchType === 'recurring' && <Input label="Quantidade de repetições" type="number" min="1" max="120" value={form.recurrenceCount} onChange={(event) => set('recurrenceCount', event.target.value)} required />}
          {isCrIncome && form.launchType !== 'recurring' && <label className="quick-entry__budget-toggle">
            <input type="checkbox" checked={form.includeInBudget} onChange={(event) => set('includeInBudget', event.target.checked)} />
            <span><strong>Considerar no orçamento</strong><small>Desmarcado: registra a entrada financeira, mas não soma na receita realizada do orçamento da CR.</small></span>
          </label>}
        </div>

        <Button className="quick-entry__action-row" variant="secondary" onClick={() => setMoreOptions((value) => !value)} aria-expanded={moreOptions}>
          <span>▤</span><span><strong>Observações (opcional)</strong><small>{form.notes || 'Adicione uma observação…'}</small></span><span>›</span>
        </Button>
        {moreOptions && <div className="quick-entry__notes"><Input label="Observação" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></div>}
      </div>
    </>}
  </Dialog>;
}
