import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { CardStatementBalance, CreditCard, CreditCardLimit } from '../domain/cards';
import { getFinanceRepositories } from '../infrastructure/createFinanceRepositories';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { SortableHandle } from '../../../shared/ui/SortableHandle';
import '../../home/ui/bank-brand.css';
import './cards-page.css';

type CardTone = 'itau' | 'nubank' | 'inter' | 'santander' | 'caixa' | 'sicoob' | 'bradesco' | 'bb' | 'sicredi' | 'c6' | 'generic';
type ListedCard = CreditCardLimit & { companyName: string; lastFour: string | null; dueDay: number };

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
function companyName(company: CompanySummary): string { return company.tradeName ?? company.legalName; }
function cardVisual(name: string): { tone: CardTone; mark: string; institution: string } {
  const raw = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('pt-BR');
  if (raw.includes('NUBANK') || raw.includes('NU ')) return { tone: 'nubank', mark: 'nu', institution: 'Nubank' };
  if (raw.includes('ITAU') || raw.includes('ITI')) return { tone: 'itau', mark: raw.includes('ITI') ? 'iti' : 'itaú', institution: 'Itaú' };
  if (raw.includes('INTER')) return { tone: 'inter', mark: 'inter', institution: 'Inter' };
  if (raw.includes('SANTANDER')) return { tone: 'santander', mark: 'Santander', institution: 'Santander' };
  if (raw.includes('CAIXA')) return { tone: 'caixa', mark: 'CAIXA', institution: 'Caixa' };
  if (raw.includes('SICOOB')) return { tone: 'sicoob', mark: 'SICOOB', institution: 'Sicoob' };
  if (raw.includes('BRADESCO')) return { tone: 'bradesco', mark: 'bradesco', institution: 'Bradesco' };
  if (raw.includes('BANCO DO BRASIL') || /(^|\s)BB(\s|$)/.test(raw)) return { tone: 'bb', mark: 'BB', institution: 'Banco do Brasil' };
  if (raw.includes('SICREDI')) return { tone: 'sicredi', mark: 'Sicredi', institution: 'Sicredi' };
  if (raw.includes('C6')) return { tone: 'c6', mark: 'C6', institution: 'C6 Bank' };
  return { tone: 'generic', mark: 'CARD', institution: 'Cartão' };
}

export function CardsPage({ companies }: { companies: readonly CompanySummary[] }) {
  const repositories = useMemo(() => getFinanceRepositories(), []);
  const uniqueCompanies = useMemo(() => [...new Map(companies.map((company) => [company.id, company])).values()], [companies]);
  const [cards, setCards] = useState<readonly ListedCard[]>([]);
  const [selected, setSelected] = useState<ListedCard | null>(null);
  const [statements, setStatements] = useState<readonly CardStatementBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = uniqueCompanies[0]?.tenantId ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const groups = await Promise.all(uniqueCompanies.map(async (company) => {
        const scope = { tenantId: company.tenantId, companyId: company.id };
        const [limits, registered] = await Promise.all([
          repositories.cards.listLimits(scope),
          repositories.cards.listCards(scope),
        ]);
        const byId = new Map<string, CreditCard>(registered.map((item) => [item.id, item]));
        return limits.map((item) => {
          const card = byId.get(item.cardId);
          return { ...item, companyName: companyName(company), lastFour: card?.lastFour ?? null, dueDay: card?.dueDay ?? 0 };
        });
      }));
      const uniqueCards = [...new Map(groups.flat().map((item) => [item.cardId, item])).values()];
      setCards(uniqueCards.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
    } catch {
      setError('Não foi possível carregar os cartões.');
    } finally {
      setLoading(false);
    }
  }, [repositories.cards, uniqueCompanies]);

  useEffect(() => { void load(); }, [load]);

  async function reorder(orderedIds: readonly string[]) {
    if (!tenantId || orderedIds.length < 2) return;
    try {
      setError(null);
      await repositories.cards.reorder(tenantId, orderedIds);
      await load();
      window.dispatchEvent(new Event('finance-card-order-changed'));
    } catch {
      setError('Não foi possível salvar a nova ordem dos cartões.');
    }
  }

  async function openDetails(item: ListedCard) {
    setSelected(item);
    setDetailsLoading(true);
    try {
      const items = await repositories.cards.listStatements({ tenantId: item.tenantId, companyId: item.companyId }, item.cardId);
      setStatements(items);
    } catch {
      setStatements([]);
      setError('Não foi possível carregar as faturas deste cartão.');
    } finally {
      setDetailsLoading(false);
    }
  }

  if (loading) return <LoadingState label="Carregando cartões…" />;
  if (cards.length === 0) return <><PageHeader title="Cartões"/><EmptyState title="Nenhum cartão" message="Não há cartões ativos para exibir." /></>;

  const totalLimit = cards.reduce((sum, item) => sum + item.creditLimit, 0);
  const totalUsed = cards.reduce((sum, item) => sum + item.committedAmount, 0);
  const totalAvailable = cards.reduce((sum, item) => sum + item.availableLimit, 0);

  return <div className="cards-page">
    <PageHeader title="Cartões" />
    {error && <Feedback tone="danger" title="Cartões" message={error} />}

    <div className="cards-page__reorder-tip" role="note">
      <span className="cards-page__reorder-icon" aria-hidden="true">i</span>
      <span><strong>Ordene como quiser</strong><small>Segure o ícone ⋮⋮ e arraste para reorganizar a ordem dos cartões.</small></span>
    </div>

    <div className="cards-page__summary" aria-label="Resumo dos cartões">
      <Card><span>Limite total</span><strong>{currency.format(totalLimit)}</strong></Card>
      <Card><span>Utilizado</span><strong className="cards-page__used">{currency.format(totalUsed)}</strong></Card>
      <Card><span>Disponível</span><strong className="cards-page__available">{currency.format(totalAvailable)}</strong></Card>
    </div>

    <div className="cards-page__list" aria-label="Cartões">
      {cards.map((item) => {
        const visual = cardVisual(item.name);
        return <div key={item.cardId} className={`cards-page__item bank-brand bank-brand--${visual.tone}`} data-sort-group="credit-card-global" data-sort-tenant={tenantId} data-sort-id={item.cardId}>
          <SortableHandle itemId={item.cardId} tenantId={tenantId} group="credit-card-global" label={`Arrastar ${item.name} para reorganizar`} onReorder={reorder} />
          <Button variant="tertiary" className="cards-page__card" onClick={() => { void openDetails(item); }} aria-label={`Abrir detalhes de ${item.name}`}>
            <span className="bank-brand__mark" aria-hidden="true">{visual.mark}</span>
            <span className="cards-page__identity"><strong>{item.name}</strong><small>{item.lastFour ? `Final ${item.lastFour}` : visual.institution}</small>{item.dueDay > 0 && <small>Vence dia {item.dueDay}</small>}</span>
            <span className="cards-page__limits">
              <span><small>Limite</small><strong>{currency.format(item.creditLimit)}</strong></span>
              <span><small>Utilizado</small><strong className="cards-page__used">{currency.format(item.committedAmount)}</strong></span>
              <span><small>Disponível</small><strong className="cards-page__available">{currency.format(item.availableLimit)}</strong></span>
            </span>
            <span className="cards-page__chevron" aria-hidden="true">›</span>
          </Button>
        </div>;
      })}
    </div>

    <Dialog open={selected !== null} title={selected?.name ?? 'Cartão'} description={selected?.lastFour ? `Final ${selected.lastFour}` : undefined} onClose={() => setSelected(null)} onBack={() => setSelected(null)}>
      {selected && <div className="cards-page__details">
        <div className="cards-page__summary cards-page__summary--dialog">
          <Card><span>Limite</span><strong>{currency.format(selected.creditLimit)}</strong></Card>
          <Card><span>Utilizado</span><strong className="cards-page__used">{currency.format(selected.committedAmount)}</strong></Card>
          <Card><span>Disponível</span><strong className="cards-page__available">{currency.format(selected.availableLimit)}</strong></Card>
        </div>
        <h3>Faturas</h3>
        {detailsLoading ? <LoadingState label="Carregando faturas…" /> : statements.length === 0 ? <p className="ui-muted">Nenhuma fatura encontrada.</p> : <div className="cards-page__statements">{statements.map((statement) => <div key={statement.statementId}><span><strong>{statement.statementMonth.slice(0, 7).split('-').reverse().join('/')}</strong><small>Vence {statement.dueDate.split('-').reverse().join('/')}</small></span><span><strong>{currency.format(statement.statementAmount)}</strong><small>{statement.paymentStatus === 'paid' ? 'Paga' : statement.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'}</small></span></div>)}</div>}
      </div>}
    </Dialog>
  </div>;
}
