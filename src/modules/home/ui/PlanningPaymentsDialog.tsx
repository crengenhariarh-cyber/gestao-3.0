import { useMemo, useState } from 'react';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import type { FinancialEntryListItem } from '../../finance/domain/entries';
import type { FinancialAccount } from '../../finance/domain/registries';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import type { HomeEntry } from './useHomeOverview';
import './planning-payments.css';

interface PlanningPaymentsDialogProps {
  open: boolean;
  entries: readonly HomeEntry[];
  onClose: () => void;
  onChanged: () => void;
}

type ActionKind = 'payment' | 'edit' | 'delete' | null;

const finance = getFinanceRepositories();
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (value: number) => currency.format(value);
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) => value.split('-').reverse().join('/');
const actionKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const actualInstallmentId = (item: HomeEntry) => item.sourceKind === 'financial_installment' ? item.installmentId.replace(/^financial:/, '') : item.installmentId;

function parseCardItem(item: HomeEntry) {
  const match = /^card:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i.exec(item.installmentId);
  return match ? { cardId: match[1], statementMonth: match[2] } : null;
}

export function PlanningPaymentsDialog({ open, entries, onClose, onChanged }: PlanningPaymentsDialogProps) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [action, setAction] = useState<ActionKind>(null);
  const [target, setTarget] = useState<HomeEntry | null>(null);
  const [accounts, setAccounts] = useState<readonly FinancialAccount[]>([]);
  const [loadedEntry, setLoadedEntry] = useState<FinancialEntryListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ accountId: '', settledOn: today(), amount: '', notes: '' });
  const [editForm, setEditForm] = useState({ description: '', dueDate: today(), totalAmount: '', installmentCount: 1 });

  const expenses = useMemo(() => entries.filter(item => item.entryType === 'expense' && (!from || item.dueDate >= from) && (!to || item.dueDate <= to)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description)), [entries, from, to]);
  const keys = expenses.map(item => `${item.companyId}|${item.installmentId}`);
  const selectedItems = expenses.filter(item => selected.includes(`${item.companyId}|${item.installmentId}`));
  const selectedTotal = selectedItems.reduce((total, item) => total + item.amount, 0);
  const allSelected = expenses.length > 0 && expenses.every(item => selected.includes(`${item.companyId}|${item.installmentId}`));

  function closeAction() { setAction(null); setTarget(null); setLoadedEntry(null); setError(null); }
  function toggle(item: HomeEntry) {
    const key = `${item.companyId}|${item.installmentId}`;
    setSelected(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  }
  function toggleAll() {
    setSelected(current => allSelected ? current.filter(value => !keys.includes(value)) : [...new Set([...current, ...keys])]);
  }

  async function openPayment(item: HomeEntry) {
    setBusy(true); setError(null); setSuccess(null); setTarget(item);
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const accountList = (await finance.registries.listAccounts(scope)).filter(account => account.status === 'active');
      setAccounts(accountList);
      setPaymentForm({ accountId: '', settledOn: today(), amount: String(item.amount), notes: '' });
      setAction('payment');
    } catch { setError('Não foi possível carregar as contas disponíveis para pagamento.'); }
    finally { setBusy(false); }
  }

  async function savePayment() {
    if (!target || !paymentForm.accountId || Number(paymentForm.amount) <= 0) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      const scope = { tenantId: target.tenantId, companyId: target.companyId };
      if (target.sourceKind === 'financial_installment') {
        await finance.settlements.record({ ...scope, installmentId: actualInstallmentId(target), accountId: paymentForm.accountId, settledOn: paymentForm.settledOn, amount: Number(paymentForm.amount), idempotencyKey: actionKey('planning-payment'), notes: paymentForm.notes || null });
      } else {
        const card = parseCardItem(target);
        if (!card) throw new Error('Fatura inválida');
        const existing = (await finance.cards.listStatements(scope, card.cardId)).find(statement => statement.statementMonth === card.statementMonth);
        const statement = existing ?? await finance.cards.closeStatement({ ...scope, cardId: card.cardId, statementMonth: card.statementMonth });
        await finance.cards.recordStatementPayment({ ...scope, statementId: statement.statementId, accountId: paymentForm.accountId, paidOn: paymentForm.settledOn, amount: Number(paymentForm.amount), idempotencyKey: actionKey('planning-card-payment'), notes: paymentForm.notes || null });
      }
      setSuccess('Pagamento registrado. O planejamento e o saldo serão atualizados.');
      setSelected(current => current.filter(value => value !== `${target.companyId}|${target.installmentId}`));
      closeAction(); onChanged();
    } catch { setError('Não foi possível registrar o pagamento. Nenhuma segunda baixa foi criada.'); }
    finally { setBusy(false); }
  }

  async function openEdit(item: HomeEntry) {
    if (item.sourceKind !== 'financial_installment') return;
    setBusy(true); setError(null); setSuccess(null); setTarget(item);
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const list = await finance.entries.list(scope);
      const current = list.find(entry => entry.installmentId === actualInstallmentId(item));
      if (!current) throw new Error('Lançamento não encontrado');
      const series = list.filter(entry => entry.entryId === current.entryId).sort((a, b) => a.installmentNumber - b.installmentNumber);
      setLoadedEntry(current);
      setEditForm({ description: current.description, dueDate: series[0]?.dueDate ?? current.dueDate, totalAmount: String(series.reduce((total, entry) => total + entry.amount, 0)), installmentCount: current.installmentCount });
      setAction('edit');
    } catch { setError('Não foi possível carregar o lançamento para edição.'); }
    finally { setBusy(false); }
  }

  async function saveEdit() {
    if (!target || !loadedEntry || !editForm.description.trim() || Number(editForm.totalAmount) <= 0) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      await finance.entries.update({ tenantId: target.tenantId, companyId: target.companyId, entryId: loadedEntry.entryId, entryType: loadedEntry.entryType, description: editForm.description.trim(), counterpartyName: loadedEntry.counterpartyName, categoryId: loadedEntry.categoryId, costCenterId: loadedEntry.costCenterId, competenceMonth: loadedEntry.competenceMonth, dueDate: editForm.dueDate, amount: Number(editForm.totalAmount), installmentCount: editForm.installmentCount, notes: loadedEntry.notes });
      setSuccess('Lançamento atualizado.'); closeAction(); onChanged();
    } catch { setError('Não foi possível editar. Lançamentos com baixa podem ter restrições de alteração.'); }
    finally { setBusy(false); }
  }

  async function openDelete(item: HomeEntry) {
    if (item.sourceKind !== 'financial_installment') return;
    setBusy(true); setError(null); setSuccess(null); setTarget(item);
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const list = await finance.entries.list(scope);
      const current = list.find(entry => entry.installmentId === actualInstallmentId(item));
      if (!current) throw new Error('Lançamento não encontrado');
      setLoadedEntry(current); setAction('delete');
    } catch { setError('Não foi possível carregar o lançamento para exclusão.'); }
    finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!target || !loadedEntry) return;
    setBusy(true); setError(null); setSuccess(null);
    try {
      await finance.entries.deleteUnsettled({ tenantId: target.tenantId, companyId: target.companyId }, loadedEntry.entryId);
      setSuccess('Lançamento excluído.');
      setSelected(current => current.filter(value => value !== `${target.companyId}|${target.installmentId}`));
      closeAction(); onChanged();
    } catch { setError('Não foi possível excluir. Lançamentos que já possuem baixa não são removidos.'); }
    finally { setBusy(false); }
  }

  const accountOptions = [{ value: '', label: 'Selecione…' }, ...accounts.map(account => ({ value: account.id, label: account.name }))];

  return <>
    <Dialog open={open} title="Planejar pagamentos" description="Selecione contas para somar ou opere cada despesa aqui mesmo: editar, excluir ou pagar." onClose={onClose} onBack={onClose}>
      <div className="planning-payments">
        {error && action === null && <Feedback tone="danger" title="Operação não concluída" message={error} />}
        {success && <Feedback tone="success" title="Concluído" message={success} />}
        <div className="planning-payments__filters"><Input label="De" type="date" value={from} onChange={event => setFrom(event.target.value)} /><Input label="Até" type="date" value={to} onChange={event => setTo(event.target.value)} /></div>
        <div className="planning-payments__summary"><span>{selectedItems.length} de {expenses.length} selecionada(s)</span><strong>{money(selectedTotal)}</strong></div>
        {expenses.length > 0 && <Button onClick={toggleAll}>{allSelected ? 'Limpar seleção' : 'Selecionar todas'}</Button>}
        <div className="planning-payments__list">{expenses.length === 0 ? <p className="ui-muted">Nenhuma despesa pendente neste período.</p> : expenses.map(item => {
          const key = `${item.companyId}|${item.installmentId}`;
          const isSelected = selected.includes(key);
          const installment = item.sourceKind === 'financial_installment' && item.installmentCount > 1 ? ` · Parcela ${item.installmentNumber}/${item.installmentCount}` : '';
          return <Card key={key} className={`${item.dueDate < today() ? 'is-danger ' : ''}${isSelected ? 'planning-item--selected' : ''}`.trim()}>
            <div className="planning-payments__details"><div><span>{item.description}{installment}</span><strong>{money(item.amount)}</strong></div><div><span>{dateLabel(item.dueDate)}</span><strong>{item.companyName}{item.sourceKind === 'card_statement' ? ' · Cartão' : ''}</strong></div></div>
            <div className="planning-payments__actions">
              <Button size="sm" onClick={() => toggle(item)} aria-pressed={isSelected}>{isSelected ? '✓ Selecionado' : 'Selecionar'}</Button>
              {item.sourceKind === 'financial_installment' && <Button size="sm" variant="secondary" onClick={() => { void openEdit(item); }}>Editar</Button>}
              {item.sourceKind === 'financial_installment' && <Button size="sm" variant="tertiary" onClick={() => { void openDelete(item); }}>Excluir</Button>}
              <Button size="sm" onClick={() => { void openPayment(item); }}>Pagar</Button>
            </div>
          </Card>;
        })}</div>
      </div>
    </Dialog>

    <Dialog open={action === 'payment'} title={target?.sourceKind === 'card_statement' ? 'Pagar fatura' : 'Registrar pagamento'} description={target ? `${target.description} · ${money(target.amount)}` : undefined} loading={busy} confirmLabel="Pagar" onClose={closeAction} onBack={closeAction} onConfirm={() => { void savePayment(); }}>
      {error && <Feedback tone="danger" title="Não foi possível pagar" message={error} />}
      <div className="planning-payments__filters"><Select label="Conta" value={paymentForm.accountId} onChange={event => setPaymentForm(current => ({ ...current, accountId: event.target.value }))} options={accountOptions} required /><Input label="Data" type="date" value={paymentForm.settledOn} onChange={event => setPaymentForm(current => ({ ...current, settledOn: event.target.value }))} required /><Input label="Valor" type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={event => setPaymentForm(current => ({ ...current, amount: event.target.value }))} required /><Input label="Observação" value={paymentForm.notes} onChange={event => setPaymentForm(current => ({ ...current, notes: event.target.value }))} /></div>
    </Dialog>

    <Dialog open={action === 'edit'} title="Editar lançamento" description={loadedEntry && loadedEntry.installmentCount > 1 ? `Este lançamento possui ${loadedEntry.installmentCount} parcelas; a edição é da série.` : 'Edite sem sair do planejamento.'} loading={busy} confirmLabel="Salvar" onClose={closeAction} onBack={closeAction} onConfirm={() => { void saveEdit(); }}>
      {error && <Feedback tone="danger" title="Não foi possível editar" message={error} />}
      <div className="planning-payments__filters"><Input label="Descrição" value={editForm.description} onChange={event => setEditForm(current => ({ ...current, description: event.target.value }))} required /><Input label="Primeiro vencimento" type="date" value={editForm.dueDate} onChange={event => setEditForm(current => ({ ...current, dueDate: event.target.value }))} required /><Input label="Valor total" type="number" min="0.01" step="0.01" value={editForm.totalAmount} onChange={event => setEditForm(current => ({ ...current, totalAmount: event.target.value }))} required /></div>
    </Dialog>

    <Dialog open={action === 'delete'} title="Excluir lançamento" description={target ? `Excluir ${target.description}? Em séries parceladas, a exclusão corresponde ao lançamento e suas parcelas ainda não baixadas.` : undefined} loading={busy} confirmLabel="Excluir" onClose={closeAction} onBack={closeAction} onConfirm={() => { void confirmDelete(); }}>
      {error && <Feedback tone="danger" title="Não foi possível excluir" message={error} />}
    </Dialog>
  </>;
}
