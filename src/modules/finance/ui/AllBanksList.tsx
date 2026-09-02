import { useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialAccountBalance, FinancialAccountMovement } from '../domain/accounts';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { SortableHandle } from '../../../shared/ui/SortableHandle';
import '../../home/ui/bank-brand.css';
import './all-banks-list.css';

type BankTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';
type ListedAccount = FinancialAccountBalance & { companyName: string };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function bankVisual(value: string | null, fallbackName: string): { tone: BankTone; mark: string; bank: string } {
  const raw = `${value ?? ''} ${fallbackName}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  if (raw.includes('NUBANK')) return { tone: 'nubank', mark: 'nu', bank: 'Nubank' };
  if (raw.includes('ITAU')) return { tone: 'itau', mark: 'itaú', bank: 'Itaú' };
  if (raw.includes('INTER')) return { tone: 'inter', mark: 'inter', bank: 'Inter' };
  if (raw.includes('SANTANDER')) return { tone: 'santander', mark: 'Santander', bank: 'Santander' };
  if (raw.includes('CAIXA')) return { tone: 'caixa', mark: 'CAIXA', bank: 'Caixa' };
  if (raw.includes('SICOOB')) return { tone: 'sicoob', mark: 'SICOOB', bank: 'Sicoob' };
  if (raw.includes('BRADESCO')) return { tone: 'bradesco', mark: 'bradesco', bank: 'Bradesco' };
  if (raw.includes('BANCO DO BRASIL') || /(^|\s)BB(\s|$)/.test(raw)) return { tone: 'bb', mark: 'BB', bank: 'Banco do Brasil' };
  if (raw.includes('SICREDI')) return { tone: 'sicredi', mark: 'Sicredi', bank: 'Sicredi' };
  if (raw.includes('C6')) return { tone: 'c6', mark: 'C6', bank: 'C6 Bank' };
  return { tone: 'generic', mark: '', bank: 'Banco' };
}
function monthRange() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { start: `${y}-${m}-01`, end: `${y}-${m}-${String(new Date(y, now.getMonth() + 1, 0).getDate()).padStart(2, '0')}` };
}
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }

export function AllBanksList({ companies }: { companies: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const [accounts, setAccounts] = useState<readonly ListedAccount[]>([]);
  const [selected, setSelected] = useState<ListedAccount | null>(null);
  const [movements, setMovements] = useState<readonly FinancialAccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractLoading, setExtractLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = companies[0]?.tenantId ?? '';

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const groups = await Promise.all(companies.map(async (company) => {
        const scope = { tenantId: company.tenantId, companyId: company.id };
        const balances = await repositories.accounts.listBalances(scope);
        return balances.filter((item) => item.status === 'active').map((item) => ({ ...item, companyName: companyName(company) }));
      }));
      setAccounts(groups.flat().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    } catch {
      setError('Não foi possível carregar as contas bancárias.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [companies]);

  async function reorder(orderedIds: readonly string[]) {
    if (!tenantId || orderedIds.length < 2) return;
    try {
      setError(null);
      await repositories.accounts.reorder(tenantId, orderedIds);
      await load();
      window.dispatchEvent(new Event('finance-bank-order-changed'));
    } catch {
      setError('Não foi possível salvar a nova ordem das contas.');
    }
  }

  async function openExtract(account: ListedAccount) {
    setSelected(account);
    setExtractLoading(true);
    const range = monthRange();
    try {
      const items = await repositories.accounts.listMovements({ tenantId: account.tenantId, companyId: account.companyId }, range.start, range.end);
      setMovements(items.filter((item) => item.accountId === account.accountId).sort((a, b) => `${b.movementOn}:${b.id}`.localeCompare(`${a.movementOn}:${a.id}`)));
    } catch {
      setMovements([]);
      setError('Não foi possível carregar o extrato desta conta.');
    } finally {
      setExtractLoading(false);
    }
  }

  if (loading) return <LoadingState label="Carregando bancos…" />;
  if (accounts.length === 0) return <EmptyState title="Nenhuma conta" message="Não há contas bancárias ativas para exibir." />;

  return <>
    {error && <Feedback tone="danger" title="Bancos" message={error} />}
    <div className="all-banks-list" aria-label="Contas bancárias de todas as empresas">
      {accounts.map((item) => {
        const brand = bankVisual(item.bankInstitution, item.name);
        return <div key={item.accountId} className={`all-banks-list__item bank-brand bank-brand--${brand.tone}`} data-sort-group="bank-account-global" data-sort-tenant={tenantId} data-sort-id={item.accountId}>
          <SortableHandle itemId={item.accountId} tenantId={tenantId} group="bank-account-global" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorder} />
          <Button variant="tertiary" className="all-banks-list__card" onClick={() => { void openExtract(item); }} aria-label={`Abrir extrato de ${item.name}, ${brand.bank}, saldo ${currency.format(item.currentBalance)}`}>
            {brand.mark && <span className="bank-brand__mark" aria-hidden="true">{brand.mark}</span>}
            <span className="all-banks-list__copy"><strong>{item.name}</strong><small>{brand.bank}</small></span>
            <strong className="all-banks-list__balance">{currency.format(item.currentBalance)}</strong>
            <small className="all-banks-list__hint">Toque para abrir o extrato ›</small>
          </Button>
        </div>;
      })}
    </div>
    <Dialog open={selected !== null} title={selected?.name ?? 'Extrato'} description={selected ? `Saldo ${currency.format(selected.currentBalance)}` : undefined} onClose={() => setSelected(null)} onBack={() => setSelected(null)}>
      {extractLoading ? <LoadingState label="Carregando extrato…" /> : movements.length === 0 ? <p className="ui-muted">Nenhuma movimentação neste mês.</p> : <div className="all-banks-list__extract">{movements.map((item) => <div key={item.id}><span>{item.movementOn.split('-').reverse().join('/')}</span><strong>{item.description || 'Movimentação'}</strong><b>{item.direction === 'inflow' ? '+' : '-'} {currency.format(item.amount)}</b></div>)}</div>}
    </Dialog>
  </>;
}
