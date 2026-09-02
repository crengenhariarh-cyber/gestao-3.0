import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { CardStatementBalance, CardStatementItem, CreditCard, CreditCardLimit } from '../domain/cards';
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
function monthKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`; }
function monthLabel(value: string): string { return value.slice(0, 7).split('-').reverse().join('/'); }
function dateLabel(value: string): string { return value.split('-').reverse().join('/'); }
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
  const [statementItems, setStatementItems] = useState<readonly CardStatementItem[]>([]);
  const [statements, setStatements] = useState<readonly CardStatementBalance[]>([]);
  const [selectedStatementMonth, setSelectedStatementMonth] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tenantId = uniqueCompanies[0]?.tenantId ?? '';
  const currentMonth = monthKey();

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
        return limits.flatMap((item) => {
          const card = byId.get(item.cardId);
          if (!card || card.status !== 'active') return [];
          return [{ ...item, companyName: companyName(company), lastFour: card.lastFour ?? null, dueDay: card.dueDay ?? 0 }];
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
    setStatementItems([]);
    setStatements([]);
    setSelectedStatementMonth('');
    try {
      const scope = { tenantId: item.tenantId, companyId: item.companyId };
      const [items, closed] = await Promise.all([
        repositories.cards.listStatementItems(scope, item.cardId),
        repositories.cards.listStatements(scope, item.cardId),
      ]);
      setStatementItems(items);
      setStatements(closed);
      const availableMonths = [...new Set(items.map((line) => line.statementMonth))]
        .filter((month) => month <= currentMonth)
        .sort((a, b) => b.localeCompare(a));
      setSelectedStatementMonth(availableMonths.includes(currentMonth) ? currentMonth : availableMonths[0] ?? '');
    } catch {
      setStatementItems([]);
      setStatements([]);
      setError('Não foi possível carregar as faturas deste cartão.');
    } finally {
      setDetailsLoading(false);
    }
  }

  const selectableMonths = useMemo(() => [...new Set(statementItems.map((line) => line.statementMonth))]
    .filter((month) => month <= currentMonth)
    .sort((a, b) => b.localeCompare(a)), [statementItems, currentMonth]);

  const selectedItems = useMemo(() => statementItems.filter((item) => item.statementMonth === selectedStatementMonth), [statementItems, selectedStatementMonth]);
  const selectedClosedStatement = useMemo(() => statements.find((statement) => statement.statementMonth === selectedStatementMonth) ?? null, [statements, selectedStatementMonth]);
  const selectedTotal = selectedClosedStatement?.statementAmount ?? selectedItems.reduce((sum, item) => sum + item.amount, 0);

  if (loading) return <LoadingState label="Carregando cartões…" />;
  if (cards.length === 0) return <><PageHeader title="Cartões"/><EmptyState title="Nenhum cartão" message="Não há cartões ativos para exibir." /></>;

  const totalLimit = cards.reduce((sum, item) => sum + item.creditLimit, 0);
  const totalUsed = cards.reduce((sum, item) => sum + item.committedAmount, 0);
  const totalAvailable = cards.reduce((sum, item) => sum + item.availableLimit, 0);

  return <div className="cards-page">
    <PageHeader title="Cartões" />
    {error && <Feedback tone="danger" title="Cartões" message={error} />}

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
          <Button variant="tertiary" className="cards-page__card" onClick={() => { void openDetails(item); }} aria-label={`Abrir faturas de ${item.name}`}>
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

    <Dialog open={selected !== null} title={selected ? `Faturas · ${selected.name}` : 'Faturas'} description={selected?.lastFour ? `Final ${selected.lastFour}` : undefined} onClose={() => setSelected(null)} onBack={() => setSelected(null)}>
      {selected && <div className="cards-page__details">
        {detailsLoading ? <LoadingState label="Carregando faturas…" /> : selectableMonths.length === 0 ? <EmptyState title="Nenhuma fatura" message="Este cartão não possui faturas com lançamentos." /> : <>
          <div className="cards-page__statement-filter">
            <label htmlFor="card-statement-month">Fatura</label>
            <select id="card-statement-month" value={selectedStatementMonth} onChange={(event) => setSelectedStatementMonth(event.target.value)}>
              {selectableMonths.map((month) => {
                const closedStatement = statements.find((statement) => statement.statementMonth === month);
                const label = month === currentMonth ? 'Fatura atual' : closedStatement ? 'Fatura fechada' : 'Fatura anterior';
                return <option key={month} value={month}>{`${label} · ${monthLabel(month)}`}</option>;
              })}
            </select>
          </div>

          <div className="cards-page__invoice-head">
            <span><small>{selectedStatementMonth === currentMonth ? 'Fatura atual' : selectedClosedStatement ? 'Fatura fechada' : 'Fatura anterior'}</small><strong>{monthLabel(selectedStatementMonth)}</strong></span>
            <span><small>Total da fatura</small><strong>{currency.format(selectedTotal)}</strong></span>
            {selectedClosedStatement?.dueDate && <span><small>Vencimento</small><strong>{dateLabel(selectedClosedStatement.dueDate)}</strong></span>}
            {selectedClosedStatement && <span><small>Status</small><strong>{selectedClosedStatement.paymentStatus === 'paid' ? 'Paga' : selectedClosedStatement.paymentStatus === 'partial' ? 'Parcial' : 'Pendente'}</strong></span>}
          </div>

          <div className="cards-page__invoice-lines" aria-label={`Lançamentos da fatura ${monthLabel(selectedStatementMonth)}`}>
            {selectedItems.map((item) => <div key={`${item.transactionId}-${item.installmentNumber}`} className="cards-page__invoice-line">
              <span className="cards-page__invoice-description">
                <strong>{item.description}</strong>
                <small>{dateLabel(item.purchaseDate)}{item.counterpartyName ? ` · ${item.counterpartyName}` : ''}{item.installmentCount > 1 ? ` · Parcela ${item.installmentLabel}` : ''}</small>
              </span>
              <strong className="cards-page__invoice-value">{currency.format(item.amount)}</strong>
            </div>)}
          </div>
        </>}
      </div>}
    </Dialog>
  </div>;
}
