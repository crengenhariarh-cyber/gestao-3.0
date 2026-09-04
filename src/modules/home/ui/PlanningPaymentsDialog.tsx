import { useEffect, useMemo, useState } from 'react';
import { getFinanceRepositories } from '../../finance/infrastructure/createFinanceRepositories';
import type { FinancialEntryListItem } from '../../finance/domain/entries';
import type { FinancialAccount } from '../../finance/domain/registries';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { MoneyInput } from '../../../shared/ui/MoneyInput';
import { Select } from '../../../shared/ui/Select';
import type { HomeEntry } from './useHomeOverview';
import './planning-payments.css';

export type PlanningDirectAction = { item: HomeEntry; kind: 'payment' | 'edit' | 'delete'; nonce: string };

interface PlanningPaymentsDialogProps {
  open: boolean;
  entries: readonly HomeEntry[];
  onClose: () => void;
  onChanged: () => void;
  directAction?: PlanningDirectAction | null;
  onDirectActionConsumed?: () => void;
}

type ActionKind = 'payment' | 'edit' | 'delete' | null;
type PaymentMode = 'total' | 'partial';
type PaymentSummary = { original: number; paid: number; remaining: number };

const finance = getFinanceRepositories();
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (value: number) => currency.format(value);
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value: string) => value.split('-').reverse().join('/');
const actionKey = (prefix: string) => `${prefix}:${crypto.randomUUID()}`;
const actualInstallmentId = (item: HomeEntry) => item.sourceKind === 'financial_installment' ? item.installmentId.replace(/^financial:/, '') : item.installmentId;

function parseCardItem(item: HomeEntry) {
  const match = /^card:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2})$/i.exec(item.installmentId);
  return match ? { cardId: match[1]!, statementMonth: match[2]! } : null;
}

export function PlanningPaymentsDialog({ open, entries, onClose, onChanged, directAction = null, onDirectActionConsumed }: PlanningPaymentsDialogProps) {
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
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('total');
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary>({ original: 0, paid: 0, remaining: 0 });
  const [overpayConfirm, setOverpayConfirm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ accountId: '', settledOn: today(), amount: 0, notes: '' });
  const [editForm, setEditForm] = useState({ description: '', dueDate: today(), totalAmount: '', installmentCount: 1 });

  const expenses = useMemo(() => entries.filter(item => item.entryType === 'expense' && (!from || item.dueDate >= from) && (!to || item.dueDate <= to)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.description.localeCompare(b.description)), [entries, from, to]);
  const keys = expenses.map(item => `${item.companyId}|${item.installmentId}`);
  const selectedItems = expenses.filter(item => selected.includes(`${item.companyId}|${item.installmentId}`));
  const selectedTotal = selectedItems.reduce((total, item) => total + item.amount, 0);
  const allSelected = expenses.length > 0 && expenses.every(item => selected.includes(`${item.companyId}|${item.installmentId}`));
  const paymentAmount = paymentForm.amount;
  const remainingAfter = Math.max(paymentSummary.remaining - paymentAmount, 0);
  const overpayAmount = Math.max(paymentAmount - paymentSummary.remaining, 0);
  const receiving = target?.entryType === 'income';

  function closeAction() { setAction(null); setTarget(null); setLoadedEntry(null); setError(null); setOverpayConfirm(false); }
  function toggle(item: HomeEntry) {
    const key = `${item.companyId}|${item.installmentId}`;
    setSelected(current => current.includes(key) ? current.filter(value => value !== key) : [...current, key]);
  }
  function toggleAll() {
    setSelected(current => allSelected ? current.filter(value => !keys.includes(value)) : [...new Set([...current, ...keys])]);
  }
  function choosePaymentMode(mode: PaymentMode) {
    setPaymentMode(mode);
    if (mode === 'total') setPaymentForm(current => ({ ...current, amount: paymentSummary.remaining }));
  }

  async function openPayment(item: HomeEntry) {
    setBusy(true); setError(null); setSuccess(null); setTarget(item); setPaymentMode('total');
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const accountPromise = finance.registries.listTenantAccounts(item.tenantId);
      let summary: PaymentSummary;
      let preferredAccountId = '';
      if (item.sourceKind === 'financial_installment') {
        const balances = await finance.settlements.listBalances(scope);
        const balance = balances.find(entry => entry.installmentId === actualInstallmentId(item));
        summary = balance ? { original: balance.installmentAmount, paid: balance.settledAmount, remaining: balance.remainingAmount } : { original: item.amount, paid: 0, remaining: item.amount };
      } else {
        const card = parseCardItem(item);
        if (!card) throw new Error('Fatura inválida');
        const [statements, cards] = await Promise.all([finance.cards.listStatements(scope, card.cardId), finance.cards.listCards(scope)]);
        const statement = statements.find(entry => entry.statementMonth === card.statementMonth);
        summary = statement ? { original: statement.statementAmount, paid: statement.paidAmount, remaining: statement.remainingAmount } : { original: item.amount, paid: 0, remaining: item.amount };
        preferredAccountId = cards.find(entry => entry.id === card.cardId)?.defaultPaymentAccountId ?? '';
      }
      const accountList = (await accountPromise).filter(account => account.status === 'active');
      setAccounts(accountList);
      setPaymentSummary(summary);
      setPaymentForm({ accountId: accountList.some(account => account.id === preferredAccountId) ? preferredAccountId : '', settledOn: today(), amount: summary.remaining, notes: '' });
      setAction('payment');
    } catch { setError(item.entryType === 'income' ? 'Não foi possível carregar os dados do recebimento.' : 'Não foi possível carregar os dados do pagamento.'); }
    finally { setBusy(false); }
  }

  async function performPayment() {
    if (!target || !paymentForm.accountId || paymentAmount <= 0) return;
    setBusy(true); setError(null); setSuccess(null); setOverpayConfirm(false);
    try {
      const scope = { tenantId: target.tenantId, companyId: target.companyId };
      if (target.sourceKind === 'financial_installment') {
        await finance.settlements.record({ ...scope, installmentId: actualInstallmentId(target), accountId: paymentForm.accountId, settledOn: paymentForm.settledOn, amount: paymentAmount, idempotencyKey: actionKey(target.entryType === 'income' ? 'summary-receipt' : 'planning-payment'), notes: paymentForm.notes || null });
      } else {
        const card = parseCardItem(target);
        if (!card) throw new Error('Fatura inválida');
        const existing = (await finance.cards.listStatements(scope, card.cardId)).find(statement => statement.statementMonth === card.statementMonth);
        const statement = existing ?? await finance.cards.closeStatement({ ...scope, cardId: card.cardId, statementMonth: card.statementMonth });
        await finance.cards.recordStatementPayment({ ...scope, statementId: statement.statementId, accountId: paymentForm.accountId, paidOn: paymentForm.settledOn, amount: paymentAmount, idempotencyKey: actionKey('planning-card-payment'), notes: paymentForm.notes || null });
      }
      setSuccess(`${target.entryType === 'income' ? 'Recebimento' : 'Pagamento'} de ${money(paymentAmount)} registrado com sucesso.`);
      setSelected(current => current.filter(value => value !== `${target.companyId}|${target.installmentId}`));
      closeAction(); onChanged();
    } catch { setError(target.entryType === 'income' ? 'Não foi possível registrar o recebimento. Nenhuma segunda baixa foi criada.' : 'Não foi possível registrar o pagamento. Nenhuma segunda baixa foi criada.'); }
    finally { setBusy(false); }
  }

  function requestPayment() {
    if (!target || !paymentForm.accountId || paymentAmount <= 0) return;
    if (paymentAmount > paymentSummary.remaining + 0.005) { setOverpayConfirm(true); return; }
    void performPayment();
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

  useEffect(() => {
    if (!directAction) return;
    onDirectActionConsumed?.();
    if (directAction.kind === 'payment') void openPayment(directAction.item);
    else if (directAction.kind === 'edit') void openEdit(directAction.item);
    else void openDelete(directAction.item);
    // A ação direta é deliberadamente disparada apenas por um novo nonce vindo da Home.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [directAction?.nonce]);

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
          const canMaintain = item.sourceKind === 'financial_installment';
          return <Card key={key} className={`${item.dueDate < today() ? 'is-danger ' : ''}${isSelected ? 'planning-item--selected' : ''}`.trim()}>
            <div className="planning-payments__details"><div><span>{item.description}{installment}</span><strong>{money(item.amount)}</strong></div><div><span>{dateLabel(item.dueDate)}</span><strong>{item.companyName}{item.sourceKind === 'card_statement' ? ' · Cartão' : ''}</strong></div></div>
            <div className="planning-payments__actions">
              <Button size="sm" variant="primary" onClick={() => toggle(item)} aria-pressed={isSelected}>{isSelected ? '✓ Selecionado' : 'Selecionar'}</Button>
              {canMaintain && <Button size="sm" variant="primary" onClick={() => { void openEdit(item); }}>Editar</Button>}
              {canMaintain && <Button size="sm" variant="danger" onClick={() => { void openDelete(item); }}>Excluir</Button>}
              <Button size="sm" variant="success" onClick={() => { void openPayment(item); }}>Pagar</Button>
            </div>
          </Card>;
        })}</div>
      </div>
    </Dialog>

    <Dialog open={action === 'payment'} title={receiving ? 'Registrar recebimento' : 'Registrar pagamento'} description={target ? `${target.description}${target.sourceKind === 'card_statement' ? ' · FATURA DE CARTÃO' : ''}` : undefined} loading={busy} confirmLabel={receiving ? 'Confirmar recebimento' : 'Confirmar pagamento'} onClose={closeAction} onBack={closeAction} onConfirm={requestPayment}>
      <div className="payment-app">
        {error && <Feedback tone="danger" title={receiving ? 'Não foi possível receber' : 'Não foi possível pagar'} message={error} />}
        <div className="payment-app__hero"><span className="payment-app__icon" aria-hidden="true">▤</span><div><strong>{target?.description ?? (receiving ? 'Recebimento' : 'Pagamento')}</strong><span>{target?.sourceKind === 'card_statement' ? 'FATURA DE CARTÃO' : target?.installmentCount && target.installmentCount > 1 ? `PARCELA ${target.installmentNumber}/${target.installmentCount}` : receiving ? 'RECEITA' : 'DESPESA'}</span></div></div>
        <div className="payment-app__totals"><div><span>Total original</span><strong>{money(paymentSummary.original)}</strong></div><div><span>{receiving ? 'Já recebido' : 'Já pago'}</span><strong>{money(paymentSummary.paid)}</strong></div><div><span>Restante</span><strong>{money(paymentSummary.remaining)}</strong></div></div>
        <div className="payment-app__modes"><Button variant={paymentMode === 'total' ? 'primary' : 'secondary'} className="payment-app__mode" onClick={() => choosePaymentMode('total')} aria-pressed={paymentMode === 'total'}><span className="payment-app__mode-icon" aria-hidden="true">✓</span><span><strong>{receiving ? 'Recebimento total' : 'Pagamento total'}</strong><small>Liquidar o valor restante</small></span></Button><Button variant={paymentMode === 'partial' ? 'primary' : 'secondary'} className="payment-app__mode" onClick={() => choosePaymentMode('partial')} aria-pressed={paymentMode === 'partial'}><span className="payment-app__mode-icon" aria-hidden="true">◔</span><span><strong>{receiving ? 'Recebimento parcial' : 'Pagamento parcial'}</strong><small>{receiving ? 'Receber parte ou informar outro valor' : 'Pagar parte ou informar outro valor'}</small></span></Button></div>
        <div className="payment-app__bank"><Select label="Banco" value={paymentForm.accountId} onChange={event => setPaymentForm(current => ({ ...current, accountId: event.target.value }))} options={accountOptions} required /></div>
        <div className="payment-app__fields"><Input label="Data efetiva" type="date" value={paymentForm.settledOn} onChange={event => setPaymentForm(current => ({ ...current, settledOn: event.target.value }))} required /><MoneyInput label={receiving ? 'Valor efetivamente recebido' : 'Valor efetivamente pago'} value={paymentForm.amount} onValueChange={amount => setPaymentForm(current => ({ ...current, amount }))} required /></div>
        <Input label="Observação" value={paymentForm.notes} onChange={event => setPaymentForm(current => ({ ...current, notes: event.target.value }))} placeholder="Opcional" />
        <div className={`payment-app__result ${overpayAmount > 0 ? 'is-warning' : ''}`.trim()}><span>{overpayAmount > 0 ? 'Valor acima do restante' : 'Saldo restante após confirmar'}</span><strong>{overpayAmount > 0 ? `+ ${money(overpayAmount)}` : money(remainingAfter)}</strong></div>
      </div>
    </Dialog>

    <Dialog open={overpayConfirm} title={receiving ? 'Confirmar valor acima da receita' : 'Confirmar valor acima da despesa'} description={target ? `Você informou ${money(paymentAmount)}, mas o saldo restante de ${target.description} é ${money(paymentSummary.remaining)}.` : undefined} loading={busy} confirmLabel={receiving ? 'Sim, receber este valor' : 'Sim, pagar este valor'} onClose={() => setOverpayConfirm(false)} onBack={() => setOverpayConfirm(false)} onConfirm={() => { void performPayment(); }}>
      <div className="payment-app__warning"><strong>Diferença de {money(overpayAmount)}</strong><span>{receiving ? 'O valor integral informado será creditado na conta bancária. A receita ficará quitada e o excedente ficará registrado como valor efetivamente recebido.' : 'O valor integral informado será descontado da conta bancária. A despesa ficará quitada e o excedente ficará registrado como valor efetivamente pago.'}</span></div>
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
