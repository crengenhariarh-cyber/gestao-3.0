import { useEffect, useMemo, useState } from 'react';
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
const formatMoneyDigits = (digits: string) => digits ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amountFromDigits(digits)) : '';
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
function canonicalCostCenters<T extends { id: string; code: string | null; name: string }>(rows: readonly T[]): readonly { item: T; label: string }[] {
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
  const canonical = COST_CENTER_ORDER.flatMap((label) => chosen.get(label) ? [{ item: chosen.get(label)!, label }] : []);
  return [...canonical, ...extras.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((item) => ({ item, label: item.name }))];
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
  const [lastSuggestedDescription, setLastSuggestedDescription] = useState('');
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
  });

  useEffect(() => {
    if (!open) return;
    setCompanyId(initialCompanyId || companies[0]?.id || '');
    setLastSuggestedDescription('');
    setInlineRegistry(null);
    setNewRegistryName('');
    setLocalError(null);
    setLocalSuccess(null);
    setForm((current) => ({
      ...current,
      entryType: 'expense',
      date: today(),
      description: '',
      amountDigits: '',
      paymentMethod: 'pix',
      launchType: 'single',
      installmentCount: '2',
      recurrenceCount: '12',
      accountRef: '',
      cardRef: '',
      categoryId: '',
      costCenterId: '',
      counterparty: '',
      notes: '',
    }));
  }, [companies, initialCompanyId, open]);

  const company = companies.find((item) => item.id === companyId) ?? companies[0];
  const scope = useMemo(() => ({ tenantId: company?.tenantId ?? '', companyId: company?.id ?? '' }), [company?.id, company?.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

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
      const tenantId = companies[0]?.tenantId;
      const cardTemplates: SmartTemplate[] = [];
      if (tenantId) {
        const { data } = await getSupabaseClient()
          .from('card_transactions')
          .select('company_id,expense_company_id,card_id,purchase_date,description,category_id,cost_center_id')
          .eq('tenant_id', tenantId)
          .order('purchase_date', { ascending: false })
          .limit(200);
        for (const row of data ?? []) {
          const expenseCompanyId = String(row.expense_company_id ?? row.company_id ?? '');
          cardTemplates.push({
            description: String(row.description ?? ''),
            companyId: expenseCompanyId,
            entryType: 'expense',
            categoryId: String(row.category_id ?? ''),
            costCenterId: row.cost_center_id ? String(row.cost_center_id) : '',
            accountRef: '',
            paymentMethod: 'credit',
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

  const companyOptions = companies.map((item) => ({ value: item.id, label: companyName(item) }));
  const accountOptions = [
    { value: '', label: 'Selecione' },
    ...paymentAccounts.map((item) => ({ value: paymentRef(item.companyId, item.id), label: item.name })),
  ];
  const cardOptions = [
    { value: '', label: 'Selecione o cartão' },
    ...paymentCards.map((item) => ({ value: paymentRef(item.companyId, item.id), label: item.name })),
  ];
  const categoryOptions = [{ value: '', label: 'Selecione' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const costCenterOptions = [{ value: '', label: 'Selecione' }, ...costCenters.map(({ item, label }) => ({ value: item.id, label }))];
  const paymentOptions = [
    { value: 'pix', label: 'Pix' },
    { value: 'debit', label: 'Cartão de débito' },
    ...(form.entryType === 'expense' ? [{ value: 'credit', label: 'Cartão de crédito' }] : []),
    { value: 'cash', label: 'Dinheiro' },
    { value: 'transfer', label: 'Transferência' },
    { value: 'boleto', label: 'Boleto' },
    { value: 'other', label: 'Outro' },
  ];
  const launchOptions = [
    { value: 'single', label: 'Único / à vista' },
    { value: 'installment', label: 'Parcelado' },
    ...(form.paymentMethod === 'credit' ? [] : [{ value: 'recurring', label: 'Recorrente' }]),
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
  function clearSmartFill(description: string) {
    const defaultCompanyId = initialCompanyId || companies[0]?.id || '';
    setLastSuggestedDescription('');
    if (allCompaniesMode) setCompanyId(defaultCompanyId);
    setForm((current) => ({
      ...current,
      description,
      entryType: 'expense',
      paymentMethod: 'pix',
      launchType: 'single',
      accountRef: '',
      cardRef: '',
      categoryId: '',
      costCenterId: '',
    }));
  }
  function resetForNextEntry() {
    clearSmartFill('');
    setForm((current) => ({ ...current, amountDigits: '', counterparty: '', notes: '' }));
  }
  function smartFill(description: string) {
    const query = normalized(description);
    if (query.length < 3) {
      if (lastSuggestedDescription) clearSmartFill(description);
      else set('description', description);
      return;
    }
    if (query === lastSuggestedDescription) {
      set('description', description);
      return;
    }
    const candidates = templates.filter((item) => normalized(item.description) === query || normalized(item.description).includes(query));
    const match = candidates[0];
    if (!match || (!allCompaniesMode && match.companyId !== companyId)) {
      if (lastSuggestedDescription) clearSmartFill(description);
      else set('description', description);
      return;
    }
    setLastSuggestedDescription(query);
    if (allCompaniesMode) setCompanyId(match.companyId);
    setForm((current) => ({
      ...current,
      description,
      entryType: match.entryType,
      categoryId: match.categoryId,
      costCenterId: match.costCenterId,
      accountRef: match.accountRef,
      paymentMethod: match.paymentMethod,
      cardRef: match.cardRef,
      launchType: 'single',
    }));
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
    if (!company || !form.description.trim() || !Number.isFinite(amount) || amount <= 0 || !form.categoryId) return;
    if (form.paymentMethod === 'credit' && (!form.cardRef || form.entryType !== 'expense')) return;
    setSubmitting(true);
    try {
      if (form.launchType === 'recurring') {
        const count = Math.max(1, Math.trunc(Number(form.recurrenceCount || '1')));
        await operations.createRecurrence({
          entryType: form.entryType,
          description: form.description.trim(),
          counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId,
          costCenterId: form.costCenterId || null,
          amount,
          frequency: 'monthly',
          intervalCount: 1,
          startDate: form.date,
          endDate: recurrenceEnd(form.date, count),
          notes: form.notes.trim() || null,
        });
      } else if (form.paymentMethod === 'credit') {
        const card = parsePaymentRef(form.cardRef);
        if (!card) throw new Error('Selecione um cartão válido.');
        const result = await getSupabaseClient().rpc('create_card_purchase_cross_company', {
          p_tenant_id: company.tenantId,
          p_card_company_id: card.companyId,
          p_expense_company_id: company.id,
          p_card_id: card.resourceId,
          p_purchase_date: form.date,
          p_description: form.description.trim(),
          p_counterparty_name: form.counterparty.trim() || null,
          p_category_id: form.categoryId,
          p_cost_center_id: form.costCenterId || null,
          p_total_amount: amount,
          p_installment_count: form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1,
          p_idempotency_key: idempotencyKey('quick-card-purchase'),
          p_notes: form.notes.trim() || null,
        });
        if (result.error) throw result.error;
        setLocalSuccess('Compra no cartão registrada com sucesso.');
      } else {
        const created = await operations.createEntry({
          entryType: form.entryType,
          description: form.description.trim(),
          counterpartyName: form.counterparty.trim() || null,
          categoryId: form.categoryId,
          costCenterId: form.costCenterId || null,
          competenceMonth: monthStart(form.date),
          dueDate: form.date,
          amount,
          installmentCount: form.launchType === 'installment' ? Math.max(2, Math.trunc(Number(form.installmentCount || '2'))) : 1,
          notes: form.notes.trim() || null,
        });
        const account = parsePaymentRef(form.accountRef);
        if (account) await getFinanceRepositories().entries.setPlannedAccount(scope, created.entryId, account.resourceId, account.companyId);
      }
      await operations.loadReferences();
      if (keepData) resetForNextEntry(); else onClose();
    } catch (error) {
      setLocalError(error instanceof Error && error.message ? error.message : 'Não foi possível concluir o lançamento.');
    } finally {
      setSubmitting(false);
    }
  }

  const busy = operations.state.busy || paymentLoading || submitting;
  const footer = <div className="quick-entry__footer-actions">
    <Button disabled={busy} onClick={() => { void launch(true); }}>Lançar e manter dados</Button>
    <Button loading={busy} loadingLabel="Lançando…" onClick={() => { void launch(false); }}>Lançar</Button>
  </div>;

  return <Dialog open={open} title="Novo lançamento" onClose={onClose} onBack={onClose} loading={busy} footer={footer}>
    {!company ? <Feedback tone="danger" title="Empresa obrigatória" message="Selecione uma empresa para continuar." /> : !references && operations.state.busy ? <LoadingState label="Carregando dados do lançamento…" /> : <>
      {(localError ?? operations.state.errorMessage) && <Feedback tone="danger" title="Não foi possível lançar" message={localError ?? operations.state.errorMessage ?? ''} />}
      {(localSuccess ?? operations.state.successMessage) && <Feedback tone="success" title="Lançamento concluído" message={localSuccess ?? operations.state.successMessage ?? ''} />}
      <div className="quick-entry">
        <div className="quick-entry__step"><span>1</span><strong>Dados principais</strong></div>
        <div className="quick-entry__grid">
          <Select label="Tipo" value={form.entryType} onChange={(event) => set('entryType', event.target.value as EntryType)} options={[{ value: 'expense', label: 'Despesa' }, { value: 'income', label: 'Receita' }]} />
          <Input label="Data" type="date" value={form.date} onChange={(event) => set('date', event.target.value)} required />
          <Input label="Descrição" placeholder="Ex.: Café da manhã" value={form.description} onChange={(event) => smartFill(event.target.value)} required />
          <Input label="Valor" inputMode="numeric" placeholder="R$ 0,00" value={formatMoneyDigits(form.amountDigits)} onChange={(event) => set('amountDigits', digitsOnly(event.target.value))} required />
          <Select label="Forma de pagamento" value={form.paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)} options={paymentOptions} />
          <Select label="Tipo de lançamento" value={form.launchType} onChange={(event) => set('launchType', event.target.value as LaunchType)} options={launchOptions} />
          {form.launchType === 'installment' && <Input label="Quantidade de parcelas" type="number" min="2" max="120" step="1" value={form.installmentCount} onChange={(event) => set('installmentCount', event.target.value)} required />}
          {form.launchType === 'recurring' && <Input label="Quantidade de repetições" type="number" min="1" max="120" step="1" value={form.recurrenceCount} onChange={(event) => set('recurrenceCount', event.target.value)} required />}
          {form.paymentMethod === 'credit' && <Select label="Cartão" value={form.cardRef} onChange={(event) => set('cardRef', event.target.value)} options={cardOptions} required />}
          {form.paymentMethod !== 'credit' && <Select label="Banco" value={form.accountRef} onChange={(event) => set('accountRef', event.target.value)} options={accountOptions} />}
          {companies.length > 1 ? <Select label="Empresa" value={companyId} options={companyOptions} onChange={(event) => { setCompanyId(event.target.value); setInlineRegistry(null); setNewRegistryName(''); setForm((current) => ({ ...current, categoryId: '', costCenterId: '', accountRef: allCompaniesMode ? current.accountRef : '', cardRef: allCompaniesMode ? current.cardRef : '' })); }} /> : <Input label="Empresa" value={companyName(company)} disabled />}
          <div className="quick-entry__registry-field">
            <div className="quick-entry__registry-control">
              <Select label="Centro de custo" value={form.costCenterId} onChange={(event) => set('costCenterId', event.target.value)} options={costCenterOptions} />
              <Button className="quick-entry__add" aria-label="Adicionar centro de custo" title="Adicionar centro de custo" onClick={() => { setInlineRegistry(inlineRegistry === 'costCenter' ? null : 'costCenter'); setNewRegistryName(''); }}>＋</Button>
            </div>
            {inlineRegistry === 'costCenter' && <div className="quick-entry__registry-create"><Input label="Novo centro de custo" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('costCenter'); }}>Adicionar</Button></div>}
          </div>
          <div className="quick-entry__registry-field">
            <div className="quick-entry__registry-control">
              <Select label="Categoria" value={form.categoryId} onChange={(event) => set('categoryId', event.target.value)} options={categoryOptions} required />
              <Button className="quick-entry__add" aria-label="Adicionar categoria" title="Adicionar categoria" onClick={() => { setInlineRegistry(inlineRegistry === 'category' ? null : 'category'); setNewRegistryName(''); }}>＋</Button>
            </div>
            {inlineRegistry === 'category' && <div className="quick-entry__registry-create"><Input label="Nova categoria" value={newRegistryName} onChange={(event) => setNewRegistryName(event.target.value)} /><Button disabled={busy || !newRegistryName.trim()} onClick={() => { void createInlineRegistry('category'); }}>Adicionar</Button></div>}
          </div>
        </div>
        <Button className="quick-entry__more" onClick={() => setMoreOptions((value) => !value)} aria-expanded={moreOptions}>{moreOptions ? '⌃ Menos opções' : '⌄ Mais opções'}</Button>
        {moreOptions && <div className="quick-entry__more-grid"><Input label={form.entryType === 'expense' ? 'Fornecedor / beneficiário' : 'Pagador / origem'} value={form.counterparty} onChange={(event) => set('counterparty', event.target.value)} /><Input label="Observação" value={form.notes} onChange={(event) => set('notes', event.target.value)} /></div>}
      </div>
    </>}
  </Dialog>;
}
