import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { FullEntryForm } from './FullEntryForm';
import { useFinanceOperations } from './useFinanceOperations';
import './quick-entry.css';

interface QuickEntryPageProps {
  companies: readonly CompanySummary[];
  preferredCompanyId?: string | null;
}

type EntryForm = Record<string, string>;

function today(): string { return new Date().toISOString().slice(0, 10); }
function monthInput(): string { return today().slice(0, 7); }
function monthStart(value: string): string { return `${value}-01`; }
function amountValue(value: string): number { return Number(value.replace(',', '.')); }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function companyLabel(company: CompanySummary): string { return company.tradeName ?? company.legalName; }

function initialForm(): EntryForm {
  return {
    entryType: 'expense',
    dueDate: today(),
    description: '',
    amount: '',
    paymentMethod: '',
    launchMode: 'single',
    workId: '',
    categoryId: '',
    costCenterId: '',
    accountId: '',
    cardId: '',
    installmentCount: '1',
    recurrenceCount: '12',
    counterparty: '',
    competenceMonth: monthInput(),
    notes: '',
  };
}

function recurrenceEndDate(start: string, count: number): string {
  const [year, month, day] = start.split('-').map(Number);
  const targetIndex = (month - 1) + Math.max(0, count - 1);
  const targetYear = year + Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12;
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

function formError(form: EntryForm): string | null {
  if (!form.description?.trim()) return 'Informe a descrição do lançamento.';
  if (!Number.isFinite(amountValue(form.amount ?? '')) || amountValue(form.amount ?? '') <= 0) return 'Informe um valor maior que zero.';
  if (!form.paymentMethod) return 'Selecione a forma de pagamento.';
  if (!form.categoryId) return 'Selecione a categoria.';
  if (form.paymentMethod === 'credit' && !form.cardId) return 'Selecione o cartão de crédito.';
  if (form.launchMode === 'installment') {
    const count = Number(form.installmentCount ?? '0');
    if (!Number.isInteger(count) || count < 2 || count > 120) return 'Informe entre 2 e 120 parcelas.';
  }
  if (form.launchMode === 'recurring') {
    if (form.paymentMethod === 'credit') return 'Recorrência direta no cartão não é permitida. Use Único ou Parcelado.';
    const count = Number(form.recurrenceCount ?? '0');
    if (!Number.isInteger(count) || count < 2 || count > 120) return 'Informe entre 2 e 120 recorrências.';
  }
  return null;
}

export function QuickEntryPage({ companies, preferredCompanyId }: QuickEntryPageProps) {
  const navigate = useNavigate();
  const defaultCompanyId = companies.some((company) => company.id === preferredCompanyId) ? preferredCompanyId ?? '' : companies[0]?.id ?? '';
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [form, setForm] = useState<EntryForm>(() => initialForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const company = companies.find((item) => item.id === companyId) ?? companies[0];
  const scope = useMemo(() => ({ tenantId: company?.tenantId ?? '', companyId: company?.id ?? '' }), [company?.id, company?.tenantId]);
  const operations = useFinanceOperations(scope);
  const references = operations.state.references;

  if (!company) return <EmptyState title="Empresa não disponível" message="Nenhuma empresa foi liberada para este lançamento." />;
  if (!references && operations.state.busy) return <LoadingState label="Preparando lançamento…" />;

  const entryType = form.entryType === 'income' ? 'income' : 'expense';
  const categories = (references?.categories ?? []).filter((item) => item.status === 'active' && (item.kind === 'both' || item.kind === entryType));
  const works = (references?.works ?? []).filter((item) => item.status === 'active');
  const costCenters = (references?.costCenters ?? []).filter((item) => item.status === 'active');
  const accounts = (references?.accounts ?? []).filter((item) => item.status === 'active');
  const cards = (references?.cards ?? []).filter((item) => item.status === 'active');
  const companyOptions = companies.map((item) => ({ value: item.id, label: companyLabel(item) }));
  const categoryOptions = [{ value: '', label: 'Selecione…' }, ...categories.map((item) => ({ value: item.id, label: item.name }))];
  const workOptions = [{ value: '', label: 'Sem obra' }, ...works.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const costCenterOptions = [{ value: '', label: 'Sem centro de custo' }, ...costCenters.map((item) => ({ value: item.id, label: item.code ? `${item.code} · ${item.name}` : item.name }))];
  const accountOptions = [{ value: '', label: 'Selecione…' }, ...accounts.map((item) => ({ value: item.id, label: item.name }))];
  const cardOptions = [{ value: '', label: 'Selecione…' }, ...cards.map((item) => ({ value: item.id, label: item.lastFour ? `${item.name} · ${item.lastFour}` : item.name }))];

  function field(name: string, value: string) {
    setValidationError(null);
    setSuccessMessage(null);
    setForm((current) => ({ ...current, [name]: value }));
  }

  function changeCompany(nextCompanyId: string) {
    setCompanyId(nextCompanyId);
    setValidationError(null);
    setSuccessMessage(null);
    setForm((current) => ({ ...current, workId: '', categoryId: '', costCenterId: '', accountId: '', cardId: '' }));
  }

  async function save(keepData: boolean) {
    const error = formError(form);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setSuccessMessage(null);
    operations.clearFeedback();
    const amount = amountValue(form.amount ?? '0');
    const launchMode = form.launchMode ?? 'single';
    const paymentMethod = form.paymentMethod as 'pix' | 'debit' | 'credit' | 'cash' | 'transfer' | 'boleto' | 'other';

    try {
      if (paymentMethod === 'credit') {
        await operations.createCardPurchase({
          cardId: form.cardId ?? '',
          purchaseDate: form.dueDate ?? today(),
          description: form.description ?? '',
          counterpartyName: form.counterparty || null,
          categoryId: form.categoryId ?? '',
          costCenterId: form.costCenterId || null,
          workId: form.workId || null,
          paymentMethod: 'credit',
          totalAmount: amount,
          installmentCount: launchMode === 'installment' ? Number(form.installmentCount ?? '1') : 1,
          idempotencyKey: key('quick-card-entry'),
          notes: form.notes || null,
        });
      } else if (launchMode === 'recurring') {
        const count = Number(form.recurrenceCount ?? '12');
        const rule = await operations.createRecurrence({
          entryType,
          description: form.description ?? '',
          counterpartyName: form.counterparty || null,
          categoryId: form.categoryId ?? '',
          costCenterId: form.costCenterId || null,
          workId: form.workId || null,
          paymentMethod,
          amount,
          frequency: 'monthly',
          intervalCount: 1,
          startDate: form.dueDate ?? today(),
          endDate: recurrenceEndDate(form.dueDate ?? today(), count),
          notes: form.notes || null,
        });
        for (let index = 0; index < count; index += 1) {
          const materialized = await operations.materializeRecurrence(rule.id);
          if (form.accountId) await operations.setEntryPlannedAccount(materialized.entryId, form.accountId);
        }
      } else {
        await operations.createEntry({
          entryType,
          description: form.description ?? '',
          counterpartyName: form.counterparty || null,
          categoryId: form.categoryId ?? '',
          costCenterId: form.costCenterId || null,
          workId: form.workId || null,
          paymentMethod,
          plannedAccountId: form.accountId || null,
          competenceMonth: monthStart(form.competenceMonth ?? monthInput()),
          dueDate: form.dueDate ?? today(),
          amount,
          installmentCount: launchMode === 'installment' ? Number(form.installmentCount ?? '1') : 1,
          notes: form.notes || null,
        });
      }

      await operations.loadReferences();
      setSuccessMessage(keepData ? 'Lançamento salvo. Empresa, obra, categoria e pagamento foram mantidos.' : 'Lançamento salvo. Formulário pronto para o próximo lançamento.');
      if (keepData) {
        setForm((current) => ({ ...current, dueDate: today(), description: '', amount: '', counterparty: '', notes: '', competenceMonth: monthInput() }));
      } else {
        setForm(initialForm());
      }
    } catch {
      // O feedback normalizado do repositório permanece visível abaixo.
    }
  }

  return (
    <section className="finance-entry-page" aria-labelledby="quick-entry-title">
      <div className="finance-entry-page__heading">
        <Button variant="secondary" onClick={() => void navigate(-1)}>← Voltar</Button>
        <div>
          <span className="ui-muted">Novo lançamento</span>
          <h1 id="quick-entry-title">Adicionar</h1>
          <p>Preencha os dados principais e escolha como o lançamento será registrado.</p>
        </div>
      </div>

      {validationError && <Feedback tone="danger" title="Revise o lançamento" message={validationError} />}
      {operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível lançar" message={operations.state.errorMessage} />}
      {successMessage && <Feedback tone="success" title="Concluído" message={successMessage} />}

      <Card className="finance-entry-page__card">
        <FullEntryForm
          companyId={company.id}
          companyOptions={companyOptions}
          form={form}
          busy={operations.state.busy}
          categoryOptions={categoryOptions}
          costCenterOptions={costCenterOptions}
          workOptions={workOptions}
          accountOptions={accountOptions}
          cardOptions={cardOptions}
          onCompanyChange={changeCompany}
          onField={field}
        />
      </Card>

      <div className="finance-entry-page__actions" aria-label="Ações do lançamento">
        <Button variant="secondary" onClick={() => { void save(true); }} disabled={operations.state.busy}>Lançar e manter dados</Button>
        <Button onClick={() => { void save(false); }} loading={operations.state.busy} loadingLabel="Lançando…">Lançar</Button>
      </div>
    </section>
  );
}
