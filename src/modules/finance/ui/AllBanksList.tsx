import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { FinancialAccountBalance, FinancialAccountMovement } from '../domain/accounts';
import type { FinancialAccountType, FinancialBankInstitution, RegistryStatus } from '../domain/registries';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { SortableHandle } from '../../../shared/ui/SortableHandle';
import '../../home/ui/bank-brand.css';
import './all-banks-list.css';

type BankTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';
type ListedAccount = FinancialAccountBalance & { companyName: string };
type AccountDialog = 'extract' | 'edit' | 'delete' | null;

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const bankInstitutionOptions = [
  { value: '', label: 'Selecione…' },
  { value: 'itau', label: 'Itaú' }, { value: 'nubank', label: 'Nubank' }, { value: 'inter', label: 'Inter' },
  { value: 'santander', label: 'Santander' }, { value: 'caixa', label: 'Caixa' }, { value: 'sicoob', label: 'Sicoob' },
  { value: 'bradesco', label: 'Bradesco' }, { value: 'bb', label: 'Banco do Brasil' }, { value: 'sicredi', label: 'Sicredi' }, { value: 'c6', label: 'C6 Bank' },
];
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
  const [dialog, setDialog] = useState<AccountDialog>(null);
  const [menuAccountId, setMenuAccountId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', accountType: 'bank' as FinancialAccountType, bankInstitution: '' as FinancialBankInstitution | '', status: 'active' as RegistryStatus });
  const [movements, setMovements] = useState<readonly FinancialAccountMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [extractLoading, setExtractLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = companies[0]?.tenantId ?? '';

  const load = useCallback(async () => {
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
  }, [companies, repositories]);

  useEffect(() => { void load(); }, [load]);

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
    setMenuAccountId(null);
    setSelected(account);
    setDialog('extract');
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

  function openEdit(account: ListedAccount) {
    setMenuAccountId(null);
    setSelected(account);
    setEditForm({ name: account.name, accountType: account.accountType, bankInstitution: account.bankInstitution ?? '', status: account.status });
    setDialog('edit');
  }

  function openDelete(account: ListedAccount) {
    setMenuAccountId(null);
    setSelected(account);
    setDialog('delete');
  }

  function closeDialog() {
    setDialog(null);
    setSelected(null);
  }

  async function saveEdit() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await repositories.registries.updateAccount({ tenantId: selected.tenantId, companyId: selected.companyId, id: selected.accountId, name: editForm.name, accountType: editForm.accountType, bankInstitution: editForm.bankInstitution || null, status: editForm.status });
      closeDialog();
      await load();
      window.dispatchEvent(new Event('finance-bank-order-changed'));
    } catch {
      setError('Não foi possível salvar as alterações do banco.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      await repositories.registries.updateAccount({ tenantId: selected.tenantId, companyId: selected.companyId, id: selected.accountId, name: selected.name, accountType: selected.accountType, bankInstitution: selected.bankInstitution, status: 'inactive' });
      closeDialog();
      await load();
      window.dispatchEvent(new Event('finance-bank-order-changed'));
    } catch {
      setError('Não foi possível excluir o banco.');
    } finally {
      setSaving(false);
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
          <Button variant="tertiary" className="all-banks-list__menu-trigger" aria-label={`Ações de ${item.name}`} aria-expanded={menuAccountId === item.accountId} onClick={() => setMenuAccountId(menuAccountId === item.accountId ? null : item.accountId)}>⋯</Button>
          {menuAccountId === item.accountId && <div className="all-banks-list__menu" role="menu"><Button variant="tertiary" onClick={() => openEdit(item)}>Editar</Button><Button variant="tertiary" className="is-danger" onClick={() => openDelete(item)}>Excluir</Button></div>}
          <Button variant="tertiary" className="all-banks-list__card" onClick={() => { void openExtract(item); }} aria-label={`Abrir extrato de ${item.name}, ${brand.bank}, saldo ${currency.format(item.currentBalance)}`}>
            {brand.mark && <span className="bank-brand__mark" aria-hidden="true">{brand.mark}</span>}
            <span className="all-banks-list__copy"><strong>{item.name}</strong><small>{brand.bank}</small></span>
            <strong className="all-banks-list__balance">{currency.format(item.currentBalance)}</strong>
            <small className="all-banks-list__hint">Toque para abrir o extrato ›</small>
          </Button>
        </div>;
      })}
    </div>

    <Dialog open={dialog === 'extract' && selected !== null} title={selected?.name ?? 'Extrato'} description={selected ? `Saldo ${currency.format(selected.currentBalance)}` : undefined} onClose={closeDialog} onBack={closeDialog}>
      {extractLoading ? <LoadingState label="Carregando extrato…" /> : movements.length === 0 ? <p className="ui-muted">Nenhuma movimentação neste mês.</p> : <div className="all-banks-list__extract">{movements.map((item) => <div key={item.id}><span>{item.movementOn.split('-').reverse().join('/')}</span><strong>{item.description || 'Movimentação'}</strong><b>{item.direction === 'inflow' ? '+' : '-'} {currency.format(item.amount)}</b></div>)}</div>}
    </Dialog>

    <Dialog open={dialog === 'edit' && selected !== null} title="Editar banco" description={selected ? selected.companyName : undefined} loading={saving} onClose={closeDialog} onBack={closeDialog} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button onClick={() => { void saveEdit(); }}>Salvar alterações</Button></>}>
      <div className="finance-form-grid">
        <Select label="Empresa" value={selected?.companyId ?? ''} disabled options={companies.map((company) => ({ value: company.id, label: companyName(company) }))} />
        <Input label="Nome da conta" value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} required />
        <Select label="Instituição" value={editForm.bankInstitution} onChange={(event) => setEditForm((current) => ({ ...current, bankInstitution: event.target.value as FinancialBankInstitution | '' }))} options={bankInstitutionOptions} />
        <Select label="Tipo" value={editForm.accountType} onChange={(event) => setEditForm((current) => ({ ...current, accountType: event.target.value as FinancialAccountType }))} options={[{ value: 'bank', label: 'Banco' }, { value: 'cash', label: 'Dinheiro' }, { value: 'other', label: 'Outra conta' }]} />
        <Select label="Status" value={editForm.status} onChange={(event) => setEditForm((current) => ({ ...current, status: event.target.value as RegistryStatus }))} options={[{ value: 'active', label: 'Ativa' }, { value: 'inactive', label: 'Inativa' }]} />
      </div>
    </Dialog>

    <Dialog open={dialog === 'delete' && selected !== null} title="Excluir banco" description={selected ? selected.companyName : undefined} loading={saving} onClose={closeDialog} onBack={closeDialog} footer={<><Button variant="secondary" onClick={closeDialog}>Cancelar</Button><Button variant="danger" onClick={() => { void confirmDelete(); }}>Excluir banco</Button></>}>
      <p>O banco será desativado para preservar o extrato e todo o histórico financeiro já registrado.</p>
    </Dialog>
  </>;
}
