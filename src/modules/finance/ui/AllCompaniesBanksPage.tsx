import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialAccountBalance } from '../domain/accounts';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { AllBanksList } from './AllBanksList';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';

type GlobalAccount = FinancialAccountBalance & { companyName: string };
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function today(): string { return new Date().toISOString().slice(0, 10); }
function money(value: string): number { return Number(value.replace(',', '.')); }

export function AllCompaniesBanksPage({ companies }: { companies: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const [accounts, setAccounts] = useState<readonly GlobalAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [form, setForm] = useState({ fromAccountId: '', toAccountId: '', transferOn: today(), amount: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const groups = await Promise.all(companies.map(async (company) => {
        const scope = { tenantId: company.tenantId, companyId: company.id };
        const balances = await repositories.accounts.listBalances(scope);
        return balances.filter((item) => item.status === 'active').map((item) => ({ ...item, companyName: companyName(company) }));
      }));
      setAccounts(groups.flat().sort((a, b) => a.companyName.localeCompare(b.companyName) || a.name.localeCompare(b.name)));
    } catch { setError('Não foi possível carregar todas as contas bancárias.'); }
    finally { setLoading(false); }
  }, [companies, repositories]);

  useEffect(() => { void load(); }, [load, refreshToken]);

  const options = [{ value: '', label: 'Selecione…' }, ...accounts.map((account) => ({ value: account.accountId, label: `${account.companyName} · ${account.name} · ${currency.format(account.currentBalance)}` }))];
  const destinationOptions = options.filter((option) => !option.value || option.value !== form.fromAccountId);

  async function transfer() {
    const from = accounts.find((item) => item.accountId === form.fromAccountId);
    const to = accounts.find((item) => item.accountId === form.toAccountId);
    const amount = money(form.amount);
    if (!from || !to) { setError('Selecione a conta de origem e a conta de destino.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setError('Informe um valor válido para a transferência.'); return; }
    if (from.accountId === to.accountId) { setError('Origem e destino precisam ser contas diferentes.'); return; }
    setBusy(true); setError(null); setSuccess(null);
    try {
      await repositories.accounts.recordTransfer({
        tenantId: from.tenantId,
        companyId: from.companyId,
        fromAccountId: from.accountId,
        toAccountId: to.accountId,
        transferOn: form.transferOn,
        amount,
        idempotencyKey: `transfer:${crypto.randomUUID()}`,
        notes: form.notes || null,
      });
      setOpen(false);
      setForm({ fromAccountId: '', toAccountId: '', transferOn: today(), amount: '', notes: '' });
      setSuccess(`Transferência de ${currency.format(amount)} registrada de ${from.companyName} para ${to.companyName}.`);
      setRefreshToken((value) => value + 1);
      window.dispatchEvent(new Event('finance-bank-order-changed'));
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : 'Não foi possível registrar a transferência.');
    } finally { setBusy(false); }
  }

  return <div className="app-company-sections app-company-sections--banks">
    <section className="app-company-sections--banks__controls" aria-label="Ações de bancos">
      <PageHeader id="all-banks-title" title="Bancos" description="Todas as empresas" actions={<Button variant="primary" onClick={() => { setError(null); setSuccess(null); setOpen(true); }}>Transferir entre bancos</Button>} />
      {success && <Feedback tone="success" title="Transferência" message={success} />}
      {error && !open && <Feedback tone="danger" title="Transferência" message={error} />}
      {loading && <LoadingState label="Carregando contas de todas as empresas…" />}
    </section>
    <AllBanksList key={refreshToken} companies={companies} />
    <Dialog open={open} title="Transferência entre bancos" description="Origem e destino podem pertencer a empresas diferentes." onClose={() => setOpen(false)} onBack={() => setOpen(false)}>
      <div className="finance-form-grid">
        {error && <Feedback tone="danger" title="Transferência" message={error} />}
        <Select label="Conta de origem" value={form.fromAccountId} options={options} onChange={(event) => setForm((current) => ({ ...current, fromAccountId: event.target.value, toAccountId: current.toAccountId === event.target.value ? '' : current.toAccountId }))} />
        <Select label="Conta de destino" value={form.toAccountId} options={destinationOptions} onChange={(event) => setForm((current) => ({ ...current, toAccountId: event.target.value }))} />
        <Input label="Data" type="date" value={form.transferOn} onChange={(event) => setForm((current) => ({ ...current, transferOn: event.target.value }))} />
        <Input label="Valor" inputMode="decimal" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0,00" />
        <Input label="Observação" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
        <div className="dialog__actions"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button><Button variant="primary" onClick={() => void transfer()} disabled={busy}>{busy ? 'Transferindo…' : 'Confirmar transferência'}</Button></div>
      </div>
    </Dialog>
  </div>;
}
