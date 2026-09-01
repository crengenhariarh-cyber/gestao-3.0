import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { PayrollEventRow } from '../application/HrOperationsRepository';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Dialog } from '../../../shared/ui/Dialog';
import { EmptyState, Feedback, LoadingState } from '../../../shared/ui/Feedback';
import { Input } from '../../../shared/ui/Input';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';
import { Tabs } from '../../../shared/ui/Tabs';
import { currentHrCompetence, useHrBudgetOverview } from './useHrBudgetOverview';
import { useHrOperations } from './useHrOperations';
import './hr.css';

interface HrBudgetPageProps { company: CompanySummary; }
type ModalKind = 'employee' | 'employeeEdit' | 'salary' | 'allocation' | 'terminate' | 'event' | 'voidEvent' | 'closePayroll' | 'statutory' | 'reopen' | 'financeConfig' | 'payables' | 'budgetPlan' | 'budgetLimit' | null;
type HrTab = 'rh' | 'folha' | 'orcamento';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const eventLabels: Record<PayrollEventRow['eventKind'], string> = { benefit: 'Benefício', advance: 'Adiantamento', overtime: 'Hora extra', absence: 'Falta', dsr: 'DSR', adjustment_earning: 'Ajuste crédito', adjustment_deduction: 'Ajuste desconto' };
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function numberValue(value: string, fallback = 0): number { const result = Number(value.replace(',', '.')); return Number.isFinite(result) ? result : fallback; }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function hrTab(value: string | null): HrTab { return value === 'folha' || value === 'orcamento' ? value : 'rh'; }

export function HrBudgetPage({ company }: HrBudgetPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<HrTab>(() => hrTab(requestedTab));
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [competenceInput, setCompetenceInput] = useState(() => currentHrCompetence().month.slice(0, 7));
  const competenceMonth = `${competenceInput}-01`;
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const overview = useHrBudgetOverview(scope, refreshToken, competenceMonth);
  const operations = useHrOperations(scope, competenceMonth);
  const operational = operations.state.data;
  const tabs = useMemo(() => [{ id: 'rh', label: 'RH' }, { id: 'folha', label: 'Folha' }, { id: 'orcamento', label: 'Orçamento' }], []);

  useEffect(() => { setActiveTab(hrTab(requestedTab)); }, [requestedTab]);
  function changeTab(id: string) { const nextTab = hrTab(id); setActiveTab(nextTab); const next = new URLSearchParams(searchParams); next.set('tab', nextTab); setSearchParams(next, { replace: true }); }

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando RH e orçamento…" />;
  if (overview.status === 'error' || overview.data === null) return <EmptyState title="RH indisponível" message={overview.errorMessage ?? 'Não foi possível carregar o módulo.'} />;

  const { salaryProjection, monthlyBudget, annualBudget } = overview.data;
  const plannedSalary = sum(salaryProjection.map((item) => item.plannedSalary));
  const realizedSalary = sum(salaryProjection.map((item) => item.realizedSalary));
  const monthlyCompany = monthlyBudget.find((item) => item.costCenterId === null);
  const annualCompany = annualBudget.find((item) => item.costCenterId === null);
  const monthlyPlanned = monthlyCompany?.plannedTotal ?? sum(monthlyBudget.map((item) => item.plannedTotal));
  const monthlyRealized = monthlyCompany?.realizedTotal ?? sum(monthlyBudget.map((item) => item.realizedTotal));
  const annualPlanned = annualCompany?.plannedTotal ?? sum(annualBudget.map((item) => item.plannedTotal));
  const annualRealized = annualCompany?.realizedTotal ?? sum(annualBudget.map((item) => item.realizedTotal));
  const monthlyByCostCenter = monthlyBudget.filter((item) => item.costCenterId !== null);
  const activeEmployees = (operational?.employees ?? []).filter((item) => item.contractStatus === 'active');
  const activeCostCenters = (operational?.costCenters ?? []).filter((item) => item.status === 'active');
  const activeCategories = (operational?.categories ?? []).filter((item) => item.status === 'active');
  const activeEvents = (operational?.payrollEvents ?? []).filter((item) => item.status === 'active');
  const closedClosings = (operational?.payrollClosings ?? []).filter((item) => item.status === 'closed');
  const eventTotal = sum(activeEvents.map((item) => item.amount));
  const closingGrossTotal = sum(closedClosings.map((item) => item.grossAmount));
  const statutoryTotal = sum(closedClosings.map((item) => item.inssAmount + item.irrfAmount + item.fgtsAmount));
  const employeeOptions = [{ value: '', label: 'Selecione…' }, ...activeEmployees.map((item) => ({ value: item.employmentContractId, label: `${item.fullName} · ${item.jobTitle}` }))];
  const closingOptions = [{ value: '', label: 'Selecione…' }, ...closedClosings.map((item) => ({ value: item.id, label: `${item.employeeName} · fechado` }))];
  const eventOptions = [{ value: '', label: 'Selecione…' }, ...activeEvents.map((item) => ({ value: item.id, label: `${item.employeeName} · ${eventLabels[item.eventKind]} · ${currency.format(item.amount)}` }))];
  const costCenterOptions = [{ value: '', label: 'Geral / sem centro' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.name }))];
  const requiredCostCenterOptions = [{ value: '', label: 'Selecione…' }, ...activeCostCenters.map((item) => ({ value: item.id, label: item.name }))];
  const categoryOptions = [{ value: '', label: 'Geral / sem categoria' }, ...activeCategories.map((item) => ({ value: item.id, label: item.name }))];
  const requiredCategoryOptions = [{ value: '', label: 'Selecione…' }, ...activeCategories.map((item) => ({ value: item.id, label: item.name }))];

  function field(name: string, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function open(kind: Exclude<ModalKind, null>, initial: Record<string, string> = {}) {
    operations.clearFeedback();
    const defaults: Record<Exclude<ModalKind, null>, Record<string, string>> = {
      employee: { fullName: '', hiredOn: today(), jobTitle: '', baseSalary: '', costCenterId: '', allocationPercent: '100' }, employeeEdit: { employmentContractId: '', fullName: '', jobTitle: '' }, salary: { employmentContractId: '', effectiveFrom: today(), baseSalary: '' }, allocation: { employmentContractId: '', effectiveFrom: today(), costCenterId: '', allocationPercent: '100' }, terminate: { employmentContractId: '', terminatedOn: today() }, event: { employmentContractId: '', costCenterId: '', occurredOn: today(), eventKind: 'advance', amount: '', quantity: '', unitValue: '', description: '' }, voidEvent: { payrollEventId: '', reason: '' }, closePayroll: { employmentContractId: '' }, statutory: { payrollClosingId: '', dependents: '0', deductions: '0' }, reopen: { payrollClosingId: '', reason: '' }, financeConfig: { salaryCategoryId: '', fgtsCategoryId: '', inssCategoryId: '', irrfCategoryId: '' }, payables: { salaryDueDate: today(), fgtsDueDate: today(), inssDueDate: today(), irrfDueDate: today() }, budgetPlan: { costCenterId: '', categoryId: '', amount: '', notes: '' }, budgetLimit: { costCenterId: '', categoryId: '', amount: '', warningPercent: '80', notes: '' }
    };
    setForm({ ...defaults[kind], ...initial }); setModal(kind);
  }
  function close() { setModal(null); operations.clearFeedback(); }
  async function complete(action: () => Promise<unknown>) { await action(); setRefreshToken((value) => value + 1); setModal(null); }
  async function submitModal() {
    try {
      switch (modal) {
        case 'employee': await complete(() => operations.createEmployee({ fullName: form.fullName ?? '', hiredOn: form.hiredOn ?? today(), jobTitle: form.jobTitle ?? '', baseSalary: numberValue(form.baseSalary ?? ''), costCenterId: form.costCenterId || null, allocationPercent: numberValue(form.allocationPercent ?? '100', 100) })); break;
        case 'employeeEdit': await complete(() => operations.updateEmployeeProfile(form.employmentContractId ?? '', form.fullName ?? '', form.jobTitle ?? '')); break;
        case 'salary': await complete(() => operations.changeSalary(form.employmentContractId ?? '', form.effectiveFrom ?? today(), numberValue(form.baseSalary ?? ''))); break;
        case 'allocation': await complete(() => operations.changeAllocation(form.employmentContractId ?? '', form.effectiveFrom ?? today(), form.costCenterId ?? '', numberValue(form.allocationPercent ?? '100', 100))); break;
        case 'terminate': await complete(() => operations.terminateContract(form.employmentContractId ?? '', form.terminatedOn ?? today())); break;
        case 'event': await complete(() => operations.recordEvent({ employmentContractId: form.employmentContractId ?? '', costCenterId: form.costCenterId || null, competenceMonth, occurredOn: form.occurredOn || null, eventKind: (form.eventKind ?? 'advance') as PayrollEventRow['eventKind'], quantity: form.quantity ? numberValue(form.quantity) : null, unitValue: form.unitValue ? numberValue(form.unitValue) : null, amount: numberValue(form.amount ?? ''), description: form.description || null, idempotencyKey: key('payroll-event') })); break;
        case 'voidEvent': await complete(() => operations.voidEvent(form.payrollEventId ?? '', form.reason ?? '')); break;
        case 'closePayroll': await complete(() => operations.closePayroll(form.employmentContractId ?? '', key('payroll-close'))); break;
        case 'statutory': await complete(() => operations.calculateStatutory(form.payrollClosingId ?? '', Math.max(0, Math.trunc(numberValue(form.dependents ?? '0'))), numberValue(form.deductions ?? '0'))); break;
        case 'reopen': await complete(() => operations.reopenPayroll(form.payrollClosingId ?? '', form.reason ?? '')); break;
        case 'financeConfig': await complete(() => operations.configurePayrollFinance({ salaryCategoryId: form.salaryCategoryId ?? '', fgtsCategoryId: form.fgtsCategoryId ?? '', inssCategoryId: form.inssCategoryId ?? '', irrfCategoryId: form.irrfCategoryId ?? '' })); break;
        case 'payables': await complete(() => operations.syncPayables({ salaryDueDate: form.salaryDueDate ?? today(), fgtsDueDate: form.fgtsDueDate ?? today(), inssDueDate: form.inssDueDate ?? today(), irrfDueDate: form.irrfDueDate ?? today() })); break;
        case 'budgetPlan': await complete(() => operations.upsertBudgetPlan({ costCenterId: form.costCenterId || null, categoryId: form.categoryId || null, amount: numberValue(form.amount ?? ''), notes: form.notes || null })); break;
        case 'budgetLimit': await complete(() => operations.upsertBudgetLimit({ costCenterId: form.costCenterId || null, categoryId: form.categoryId || null, amount: numberValue(form.amount ?? ''), warningPercent: numberValue(form.warningPercent ?? '80', 80), notes: form.notes || null })); break;
        default: break;
      }
    } catch { /* feedback remains visible in the modal */ }
  }

  const modalTitles: Record<Exclude<ModalKind, null>, string> = { employee: 'Novo colaborador', employeeEdit: 'Editar colaborador', salary: 'Alterar salário', allocation: 'Alterar alocação', terminate: 'Encerrar vínculo', event: 'Evento de folha', voidEvent: 'Estornar evento', closePayroll: 'Fechar folha', statutory: 'Calcular encargos', reopen: 'Reabrir folha', financeConfig: 'Configurar integração financeira', payables: 'Gerar contas a pagar', budgetPlan: 'Planejamento mensal', budgetLimit: 'Limite mensal' };
  let modalContent = null;
  if (modal === 'employee') modalContent = <div className="hr-form-grid"><Input label="Nome completo" value={form.fullName ?? ''} onChange={(e) => field('fullName', e.target.value)} required /><Input label="Admissão" type="date" value={form.hiredOn ?? today()} onChange={(e) => field('hiredOn', e.target.value)} required /><Input label="Função" value={form.jobTitle ?? ''} onChange={(e) => field('jobTitle', e.target.value)} required /><Input label="Salário bruto" type="number" min="0" step="0.01" value={form.baseSalary ?? ''} onChange={(e) => field('baseSalary', e.target.value)} required /><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={costCenterOptions} /><Input label="Alocação %" type="number" min="1" max="100" value={form.allocationPercent ?? '100'} onChange={(e) => field('allocationPercent', e.target.value)} /></div>;
  if (modal === 'employeeEdit') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => { const employee = activeEmployees.find((item) => item.employmentContractId === e.target.value); field('employmentContractId', e.target.value); field('fullName', employee?.fullName ?? ''); field('jobTitle', employee?.jobTitle ?? ''); }} options={employeeOptions} required /><Input label="Nome completo" value={form.fullName ?? ''} onChange={(e) => field('fullName', e.target.value)} required /><Input label="Função" value={form.jobTitle ?? ''} onChange={(e) => field('jobTitle', e.target.value)} required /></div>;
  if (modal === 'salary') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => field('employmentContractId', e.target.value)} options={employeeOptions} required /><Input label="Vigência" type="date" value={form.effectiveFrom ?? today()} onChange={(e) => field('effectiveFrom', e.target.value)} required /><Input label="Novo salário bruto" type="number" min="0" step="0.01" value={form.baseSalary ?? ''} onChange={(e) => field('baseSalary', e.target.value)} required /></div>;
  if (modal === 'allocation') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => field('employmentContractId', e.target.value)} options={employeeOptions} required /><Input label="Vigência" type="date" value={form.effectiveFrom ?? today()} onChange={(e) => field('effectiveFrom', e.target.value)} required /><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={requiredCostCenterOptions} required /><Input label="Alocação %" type="number" min="1" max="100" value={form.allocationPercent ?? '100'} onChange={(e) => field('allocationPercent', e.target.value)} required /></div>;
  if (modal === 'terminate') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => field('employmentContractId', e.target.value)} options={employeeOptions} required /><Input label="Data de desligamento" type="date" value={form.terminatedOn ?? today()} onChange={(e) => field('terminatedOn', e.target.value)} required /></div>;
  if (modal === 'event') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => { const employee = activeEmployees.find((item) => item.employmentContractId === e.target.value); field('employmentContractId', e.target.value); field('costCenterId', employee?.costCenterId ?? ''); }} options={employeeOptions} required /><Select label="Evento" value={form.eventKind ?? 'advance'} onChange={(e) => field('eventKind', e.target.value)} options={Object.entries(eventLabels).map(([value, label]) => ({ value, label }))} /><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={costCenterOptions} /><Input label="Data" type="date" value={form.occurredOn ?? today()} onChange={(e) => field('occurredOn', e.target.value)} /><Input label="Valor" type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={(e) => field('amount', e.target.value)} required /><Input label="Quantidade" type="number" step="0.01" value={form.quantity ?? ''} onChange={(e) => field('quantity', e.target.value)} /><Input label="Valor unitário" type="number" step="0.01" value={form.unitValue ?? ''} onChange={(e) => field('unitValue', e.target.value)} /><Input label="Descrição" value={form.description ?? ''} onChange={(e) => field('description', e.target.value)} /></div>;
  if (modal === 'voidEvent') modalContent = <div className="hr-form-grid"><Select label="Evento" value={form.payrollEventId ?? ''} onChange={(e) => field('payrollEventId', e.target.value)} options={eventOptions} required /><Input label="Motivo do estorno" value={form.reason ?? ''} onChange={(e) => field('reason', e.target.value)} required /></div>;
  if (modal === 'closePayroll') modalContent = <div className="hr-form-grid"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => field('employmentContractId', e.target.value)} options={employeeOptions} required /></div>;
  if (modal === 'statutory') modalContent = <div className="hr-form-grid"><Select label="Fechamento" value={form.payrollClosingId ?? ''} onChange={(e) => field('payrollClosingId', e.target.value)} options={closingOptions} required /><Input label="Dependentes" type="number" min="0" step="1" value={form.dependents ?? '0'} onChange={(e) => field('dependents', e.target.value)} /><Input label="Outras deduções legais" type="number" min="0" step="0.01" value={form.deductions ?? '0'} onChange={(e) => field('deductions', e.target.value)} /></div>;
  if (modal === 'reopen') modalContent = <div className="hr-form-grid"><Select label="Fechamento" value={form.payrollClosingId ?? ''} onChange={(e) => field('payrollClosingId', e.target.value)} options={closingOptions} required /><Input label="Motivo" value={form.reason ?? ''} onChange={(e) => field('reason', e.target.value)} required /></div>;
  if (modal === 'financeConfig') modalContent = <div className="hr-form-grid"><Select label="Categoria salário" value={form.salaryCategoryId ?? ''} onChange={(e) => field('salaryCategoryId', e.target.value)} options={requiredCategoryOptions} required /><Select label="Categoria FGTS" value={form.fgtsCategoryId ?? ''} onChange={(e) => field('fgtsCategoryId', e.target.value)} options={requiredCategoryOptions} required /><Select label="Categoria INSS" value={form.inssCategoryId ?? ''} onChange={(e) => field('inssCategoryId', e.target.value)} options={requiredCategoryOptions} required /><Select label="Categoria IRRF" value={form.irrfCategoryId ?? ''} onChange={(e) => field('irrfCategoryId', e.target.value)} options={requiredCategoryOptions} required /></div>;
  if (modal === 'payables') modalContent = <div className="hr-form-grid"><Input label="Vencimento salários" type="date" value={form.salaryDueDate ?? today()} onChange={(e) => field('salaryDueDate', e.target.value)} required /><Input label="Vencimento FGTS" type="date" value={form.fgtsDueDate ?? today()} onChange={(e) => field('fgtsDueDate', e.target.value)} required /><Input label="Vencimento INSS" type="date" value={form.inssDueDate ?? today()} onChange={(e) => field('inssDueDate', e.target.value)} required /><Input label="Vencimento IRRF" type="date" value={form.irrfDueDate ?? today()} onChange={(e) => field('irrfDueDate', e.target.value)} required /></div>;
  if (modal === 'budgetPlan') modalContent = <div className="hr-form-grid"><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={costCenterOptions} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(e) => field('categoryId', e.target.value)} options={categoryOptions} /><Input label="Valor planejado" type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={(e) => field('amount', e.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(e) => field('notes', e.target.value)} /></div>;
  if (modal === 'budgetLimit') modalContent = <div className="hr-form-grid"><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={costCenterOptions} /><Select label="Categoria" value={form.categoryId ?? ''} onChange={(e) => field('categoryId', e.target.value)} options={categoryOptions} /><Input label="Limite" type="number" min="0" step="0.01" value={form.amount ?? ''} onChange={(e) => field('amount', e.target.value)} required /><Input label="Alerta em %" type="number" min="0" max="100" value={form.warningPercent ?? '80'} onChange={(e) => field('warningPercent', e.target.value)} required /><Input label="Observação" value={form.notes ?? ''} onChange={(e) => field('notes', e.target.value)} /></div>;

  return <section className="hr-overview" aria-labelledby="hr-title">
    <PageHeader id="hr-title" eyebrow={`Competência ${competenceMonth.slice(5, 7)}/${competenceMonth.slice(0, 4)}`} title="RH + Orçamento" description="Colaboradores, folha, encargos e orçamento integrados à empresa selecionada." actions={<div className="hr-competence"><Input label="Competência" type="month" value={competenceInput} onChange={(e) => setCompetenceInput(e.target.value)} /></div>} />
    <Tabs items={tabs} activeId={activeTab} onChange={changeTab} ariaLabel="RH e orçamento" />
    {operations.state.errorMessage && modal === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && modal === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    {activeTab === 'rh' && <div className="hr-overview__content hr-panel hr-panel--people" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Salário previsto"><strong className="hr-kpi">{currency.format(plannedSalary)}</strong></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Salário realizado"><strong className="hr-kpi">{currency.format(realizedSalary)}</strong></Card><Card className="hr-kpi-card" title="Vínculos ativos"><strong className="hr-kpi">{activeEmployees.length}</strong></Card></div>
      <Card className="hr-primary-card" title="Colaboradores" description="Cadastro, vínculo, salário e alocação" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('employee')}>Novo colaborador</Button><Button size="sm" variant="secondary" onClick={() => open('employeeEdit')}>Editar cadastro</Button><Button size="sm" variant="secondary" onClick={() => open('salary')}>Alterar salário</Button><Button size="sm" variant="secondary" onClick={() => open('allocation')}>Alterar alocação</Button><Button size="sm" variant="secondary" onClick={() => open('terminate')}>Encerrar vínculo</Button></div>}>{!operational || operational.employees.length === 0 ? <p className="ui-muted">Nenhum colaborador cadastrado nesta empresa.</p> : <div className="hr-list hr-list--people">{operational.employees.map((item) => <div className="hr-list__row" key={item.employmentContractId}><div><strong>{item.fullName}</strong><span className="ui-muted">{item.jobTitle} · {item.costCenterName ?? 'Sem centro de custo'} · {item.allocationPercent ?? 0}%</span></div><div className="hr-list__values"><span>{currency.format(item.baseSalary)}</span><span>{item.contractStatus}</span></div></div>)}</div>}</Card>
    </div>}

    {activeTab === 'folha' && <div className="hr-overview__content hr-panel hr-panel--payroll" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Eventos ativos"><strong className="hr-kpi">{activeEvents.length}</strong><span className="ui-muted">{currency.format(eventTotal)}</span></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Folha fechada"><strong className="hr-kpi">{currency.format(closingGrossTotal)}</strong><span className="ui-muted">{closedClosings.length} fechamentos</span></Card><Card className="hr-kpi-card" title="Encargos calculados"><strong className="hr-kpi">{currency.format(statutoryTotal)}</strong><span className="ui-muted">INSS + IRRF + FGTS</span></Card></div>
      <Card className="hr-primary-card" title="Operações da folha" description="Eventos → fechamento → encargos → Contas a Pagar" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('event')}>Novo evento</Button><Button size="sm" variant="secondary" onClick={() => open('voidEvent')}>Estornar evento</Button><Button size="sm" variant="secondary" onClick={() => open('closePayroll')}>Fechar folha</Button><Button size="sm" variant="secondary" onClick={() => open('statutory')}>Calcular encargos</Button><Button size="sm" variant="secondary" onClick={() => open('reopen')}>Reabrir</Button><Button size="sm" variant="tertiary" onClick={() => open('financeConfig')}>Configurar financeiro</Button><Button size="sm" variant="tertiary" onClick={() => open('payables')}>Gerar Contas a Pagar</Button></div>}>{(operational?.payrollEvents.length ?? 0) === 0 ? <p className="ui-muted">Nenhum evento lançado nesta competência.</p> : <div className="hr-list hr-list--events">{operational?.payrollEvents.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.employeeName}</strong><span className="ui-muted">{eventLabels[item.eventKind]} · {item.status}</span></div><div className="hr-list__values"><strong>{currency.format(item.amount)}</strong>{item.status === 'active' && <Button size="sm" variant="tertiary" onClick={() => open('voidEvent', { payrollEventId: item.id })}>Estornar</Button>}</div></div>)}</div>}</Card>
      <Card className="hr-secondary-card" title="Fechamentos" description="Bruto, INSS, IRRF e FGTS calculados por colaborador">{(operational?.payrollClosings.length ?? 0) === 0 ? <p className="ui-muted">Nenhum fechamento nesta competência.</p> : <div className="hr-list hr-list--closings">{operational?.payrollClosings.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.employeeName}</strong><span className="ui-muted">{item.status} · Bruto {currency.format(item.grossAmount)}</span></div><div className="hr-list__values"><span>INSS {currency.format(item.inssAmount)}</span><span>IRRF {currency.format(item.irrfAmount)}</span><span>FGTS {currency.format(item.fgtsAmount)}</span></div></div>)}</div>}</Card>
    </div>}

    {activeTab === 'orcamento' && <div className="hr-overview__content hr-panel hr-panel--budget" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Planejado no mês"><strong className="hr-kpi">{currency.format(monthlyPlanned)}</strong></Card><Card className="hr-kpi-card" title="Realizado no mês"><strong className="hr-kpi">{currency.format(monthlyRealized)}</strong></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Disponível no mês"><strong className="hr-kpi">{currency.format(monthlyPlanned - monthlyRealized)}</strong></Card></div>
      <Card className="hr-primary-card" title="Planejamento e limites" description="Manual + salários projetados, por empresa/obra/categoria" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('budgetPlan')}>Planejamento</Button><Button size="sm" variant="secondary" onClick={() => open('budgetLimit')}>Limite</Button></div>}>{monthlyByCostCenter.length === 0 ? <p className="ui-muted">Nenhum orçamento por centro de custo nesta competência.</p> : <div className="hr-list hr-list--budget">{monthlyByCostCenter.map((item) => <div className="hr-list__row" key={item.costCenterId ?? item.costCenterName ?? 'cc'}><strong>{item.costCenterName ?? 'Centro de custo'}</strong><div className="hr-list__values"><span>Prev. {currency.format(item.plannedTotal)}</span><span>Real. {currency.format(item.realizedTotal)}</span><span>Saldo {currency.format(item.varianceAmount)}</span></div></div>)}</div>}</Card>
      <Card className="hr-secondary-card" title="Limites cadastrados" description="Alerta por obra e categoria">{(operational?.budgetLimits.length ?? 0) === 0 ? <p className="ui-muted">Nenhum limite cadastrado para esta competência.</p> : <div className="hr-list hr-list--limits">{operational?.budgetLimits.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.costCenterName ?? 'Empresa geral'}</strong><span className="ui-muted">{item.categoryName ?? 'Todas as categorias'} · alerta {item.warningPercent}%</span></div><strong>{currency.format(item.limitAmount)}</strong></div>)}</div>}</Card>
      <Card className="hr-annual-card" title="Consolidado anual"><dl className="hr-summary"><div><dt>Previsto</dt><dd>{currency.format(annualPlanned)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(annualRealized)}</dd></div><div><dt>Saldo</dt><dd>{currency.format(annualPlanned - annualRealized)}</dd></div></dl></Card>
    </div>}

    <Dialog open={modal !== null} title={modal ? modalTitles[modal] : 'RH'} description="Operação vinculada exclusivamente à empresa e competência selecionadas." loading={operations.state.busy} onClose={close} onBack={close} onConfirm={modal ? () => { void submitModal(); } : undefined}>{operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}{modalContent}</Dialog>
  </section>;
}
