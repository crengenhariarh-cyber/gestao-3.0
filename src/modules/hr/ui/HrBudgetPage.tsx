import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import type { EmploymentType, HrEmployeeRow, PayrollEventRow } from '../application/HrOperationsRepository';
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
type HrTab = 'dashboard' | 'colaboradores' | 'folha' | 'planejamento';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const eventLabels: Record<PayrollEventRow['eventKind'], string> = { benefit: 'Benefício', advance: 'Adiantamento', overtime: 'Hora extra', absence: 'Falta', dsr: 'DSR', adjustment_earning: 'Ajuste crédito', adjustment_deduction: 'Ajuste desconto' };
const employmentTypeOptions = [
  { value: 'clt', label: 'CLT' }, { value: 'pj', label: 'PJ' }, { value: 'autonomo', label: 'Autônomo' },
  { value: 'temporario', label: 'Temporário' }, { value: 'estagio', label: 'Estágio' }, { value: 'prestador', label: 'Prestador' }, { value: 'outro', label: 'Outro' },
];
const employmentTypeLabel = new Map(employmentTypeOptions.map((item) => [item.value, item.label]));
function sum(values: readonly number[]): number { return values.reduce((total, value) => total + value, 0); }
function today(): string { return new Date().toISOString().slice(0, 10); }
function numberValue(value: string, fallback = 0): number { const result = Number(value.replace(',', '.')); return Number.isFinite(result) ? result : fallback; }
function key(prefix: string): string { return `${prefix}:${crypto.randomUUID()}`; }
function hrTab(value: string | null): HrTab { return value === 'colaboradores' || value === 'folha' || value === 'planejamento' ? value : 'dashboard'; }
function employeeInitial(item: HrEmployeeRow): Record<string, string> {
  return {
    employmentContractId: item.employmentContractId,
    fullName: item.fullName,
    jobTitle: item.jobTitle,
    cpf: item.cpf ?? '', pix: item.pix ?? '', phone: item.phone ?? '', email: item.email ?? '', notes: item.notes ?? '',
    employmentType: item.employmentType,
    sector: item.sector ?? '', supervisor: item.supervisor ?? '', weeklyHours: String(item.weeklyHours || 44),
    bankHoursEnabled: item.bankHoursEnabled ? 'true' : 'false',
  };
}

export function HrBudgetPage({ company }: HrBudgetPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<HrTab>(() => hrTab(requestedTab));
  const [modal, setModal] = useState<ModalKind>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [refreshToken, setRefreshToken] = useState(0);
  const [competenceInput, setCompetenceInput] = useState(() => currentHrCompetence().month.slice(0, 7));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState('active');
  const competenceMonth = `${competenceInput}-01`;
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const overview = useHrBudgetOverview(scope, refreshToken, competenceMonth);
  const operations = useHrOperations(scope, competenceMonth);
  const operational = operations.state.data;
  const tabs = useMemo(() => [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'colaboradores', label: 'Colaboradores' },
    { id: 'folha', label: 'Folha' },
    { id: 'planejamento', label: 'Planejamento' },
  ], []);

  useEffect(() => { setActiveTab(hrTab(requestedTab)); }, [requestedTab]);
  function changeTab(id: string) { const nextTab = hrTab(id); setActiveTab(nextTab); const next = new URLSearchParams(searchParams); next.set('tab', nextTab); setSearchParams(next, { replace: true }); }

  if (overview.status === 'idle' || overview.status === 'loading') return <LoadingState label="Carregando RH…" />;
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
  const allEmployees = operational?.employees ?? [];
  const activeEmployees = allEmployees.filter((item) => item.contractStatus === 'active');
  const filteredEmployees = allEmployees.filter((item) => {
    if (employeeStatus !== 'all' && item.contractStatus !== employeeStatus) return false;
    const term = employeeSearch.trim().toLocaleLowerCase('pt-BR');
    if (!term) return true;
    return [item.fullName, item.jobTitle, item.costCenterName, item.sector, item.supervisor, item.cpf].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term));
  });
  const activeCostCenters = (operational?.costCenters ?? []).filter((item) => item.status === 'active');
  const activeCategories = (operational?.categories ?? []).filter((item) => item.status === 'active');
  const activeEvents = (operational?.payrollEvents ?? []).filter((item) => item.status === 'active');
  const closedClosings = (operational?.payrollClosings ?? []).filter((item) => item.status === 'closed');
  const eventTotal = sum(activeEvents.map((item) => item.amount));
  const closingGrossTotal = sum(closedClosings.map((item) => item.grossAmount));
  const statutoryTotal = sum(closedClosings.map((item) => item.inssAmount + item.irrfAmount + item.fgtsAmount));
  const bankHoursCount = activeEmployees.filter((item) => item.bankHoursEnabled).length;
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
    const profileDefaults = { fullName: '', jobTitle: '', cpf: '', pix: '', phone: '', email: '', notes: '', employmentType: 'clt', sector: '', supervisor: '', weeklyHours: '44', bankHoursEnabled: 'false' };
    const defaults: Record<Exclude<ModalKind, null>, Record<string, string>> = {
      employee: { ...profileDefaults, hiredOn: today(), baseSalary: '', costCenterId: '', allocationPercent: '100' },
      employeeEdit: { ...profileDefaults, employmentContractId: '' },
      salary: { employmentContractId: '', effectiveFrom: today(), baseSalary: '' },
      allocation: { employmentContractId: '', effectiveFrom: today(), costCenterId: '', allocationPercent: '100' },
      terminate: { employmentContractId: '', terminatedOn: today() },
      event: { employmentContractId: '', costCenterId: '', occurredOn: today(), eventKind: 'advance', amount: '', quantity: '', unitValue: '', description: '' },
      voidEvent: { payrollEventId: '', reason: '' }, closePayroll: { employmentContractId: '' }, statutory: { payrollClosingId: '', dependents: '0', deductions: '0' }, reopen: { payrollClosingId: '', reason: '' },
      financeConfig: { salaryCategoryId: '', fgtsCategoryId: '', inssCategoryId: '', irrfCategoryId: '' },
      payables: { salaryDueDate: today(), fgtsDueDate: today(), inssDueDate: today(), irrfDueDate: today() },
      budgetPlan: { costCenterId: '', categoryId: '', amount: '', notes: '' }, budgetLimit: { costCenterId: '', categoryId: '', amount: '', warningPercent: '80', notes: '' },
    };
    setForm({ ...defaults[kind], ...initial }); setModal(kind);
  }
  function close() { setModal(null); operations.clearFeedback(); }
  async function complete(action: () => Promise<unknown>) { await action(); setRefreshToken((value) => value + 1); setModal(null); }
  function profileInput() {
    return {
      fullName: form.fullName ?? '', jobTitle: form.jobTitle ?? '', cpf: form.cpf || null, pix: form.pix || null, phone: form.phone || null,
      email: form.email || null, notes: form.notes || null, employmentType: (form.employmentType ?? 'clt') as EmploymentType,
      sector: form.sector || null, supervisor: form.supervisor || null, weeklyHours: numberValue(form.weeklyHours ?? '44', 44), bankHoursEnabled: form.bankHoursEnabled === 'true',
    };
  }
  async function submitModal() {
    try {
      switch (modal) {
        case 'employee': await complete(() => operations.createEmployee({ ...profileInput(), hiredOn: form.hiredOn ?? today(), baseSalary: numberValue(form.baseSalary ?? ''), costCenterId: form.costCenterId || null, allocationPercent: numberValue(form.allocationPercent ?? '100', 100) })); break;
        case 'employeeEdit': await complete(() => operations.updateEmployeeProfile(form.employmentContractId ?? '', profileInput())); break;
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

  const modalTitles: Record<Exclude<ModalKind, null>, string> = { employee: 'Novo colaborador', employeeEdit: 'Editar colaborador', salary: 'Alterar salário', allocation: 'Alterar obra / alocação', terminate: 'Encerrar vínculo', event: 'Evento de folha', voidEvent: 'Estornar evento', closePayroll: 'Fechar folha', statutory: 'Calcular encargos', reopen: 'Reabrir folha', financeConfig: 'Configurar integração financeira', payables: 'Gerar contas a pagar', budgetPlan: 'Planejamento mensal', budgetLimit: 'Limite mensal' };
  const profileFields = <>
    <Input label="Nome completo" value={form.fullName ?? ''} onChange={(e) => field('fullName', e.target.value)} required />
    <Input label="CPF" value={form.cpf ?? ''} onChange={(e) => field('cpf', e.target.value)} inputMode="numeric" />
    <Input label="Telefone" value={form.phone ?? ''} onChange={(e) => field('phone', e.target.value)} inputMode="tel" />
    <Input label="E-mail" type="email" value={form.email ?? ''} onChange={(e) => field('email', e.target.value)} />
    <Input label="PIX" value={form.pix ?? ''} onChange={(e) => field('pix', e.target.value)} />
    <Input label="Função" value={form.jobTitle ?? ''} onChange={(e) => field('jobTitle', e.target.value)} required />
    <Select label="Tipo de vínculo" value={form.employmentType ?? 'clt'} onChange={(e) => field('employmentType', e.target.value)} options={employmentTypeOptions} />
    <Input label="Setor" value={form.sector ?? ''} onChange={(e) => field('sector', e.target.value)} />
    <Input label="Encarregado / equipe" value={form.supervisor ?? ''} onChange={(e) => field('supervisor', e.target.value)} />
    <Input label="Jornada semanal" type="number" min="1" max="60" step="0.5" value={form.weeklyHours ?? '44'} onChange={(e) => field('weeklyHours', e.target.value)} />
    <Select label="Banco de horas" value={form.bankHoursEnabled ?? 'false'} onChange={(e) => field('bankHoursEnabled', e.target.value)} options={[{ value: 'false', label: 'Não' }, { value: 'true', label: 'Sim' }]} />
    <Input label="Observações" value={form.notes ?? ''} onChange={(e) => field('notes', e.target.value)} />
  </>;

  let modalContent = null;
  if (modal === 'employee') modalContent = <div className="hr-form-grid hr-form-grid--employee">{profileFields}<Input label="Admissão" type="date" value={form.hiredOn ?? today()} onChange={(e) => field('hiredOn', e.target.value)} required /><Input label="Salário bruto" type="number" min="0" step="0.01" value={form.baseSalary ?? ''} onChange={(e) => field('baseSalary', e.target.value)} required /><Select label="Obra / centro de custo" value={form.costCenterId ?? ''} onChange={(e) => field('costCenterId', e.target.value)} options={costCenterOptions} /><Input label="Alocação %" type="number" min="1" max="100" value={form.allocationPercent ?? '100'} onChange={(e) => field('allocationPercent', e.target.value)} /></div>;
  if (modal === 'employeeEdit') modalContent = <div className="hr-form-grid hr-form-grid--employee"><Select label="Colaborador" value={form.employmentContractId ?? ''} onChange={(e) => { const employee = allEmployees.find((item) => item.employmentContractId === e.target.value); setForm((current) => ({ ...current, ...(employee ? employeeInitial(employee) : { employmentContractId: e.target.value }) })); }} options={[{ value: '', label: 'Selecione…' }, ...allEmployees.map((item) => ({ value: item.employmentContractId, label: `${item.fullName} · ${item.jobTitle}` }))]} required />{profileFields}</div>;
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
    <PageHeader id="hr-title" eyebrow={`Competência ${competenceMonth.slice(5, 7)}/${competenceMonth.slice(0, 4)}`} title="RH" description="Colaboradores, folha, encargos e planejamento integrados à empresa selecionada." actions={<div className="hr-competence"><Input label="Competência" type="month" value={competenceInput} onChange={(e) => setCompetenceInput(e.target.value)} /></div>} />
    <Tabs items={tabs} activeId={activeTab} onChange={changeTab} ariaLabel="Módulos do RH" />
    {operations.state.errorMessage && modal === null && <Feedback tone="danger" title="Operação não concluída" message={operations.state.errorMessage} />}
    {operations.state.successMessage && modal === null && <Feedback tone="success" title="Concluído" message={operations.state.successMessage} />}

    {activeTab === 'dashboard' && <div className="hr-overview__content hr-panel hr-panel--dashboard" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Vínculos ativos"><strong className="hr-kpi">{activeEmployees.length}</strong><span className="ui-muted">{allEmployees.length} cadastrados</span></Card><Card className="hr-kpi-card" title="Salário previsto"><strong className="hr-kpi">{currency.format(plannedSalary)}</strong></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Salário realizado"><strong className="hr-kpi">{currency.format(realizedSalary)}</strong></Card></div>
      <div className="hr-dashboard-grid"><Card title="Operação RH" description="Visão rápida da equipe"><dl className="hr-summary hr-summary--compact"><div><dt>Banco de horas</dt><dd>{bankHoursCount}</dd></div><div><dt>Eventos da folha</dt><dd>{activeEvents.length}</dd></div><div><dt>Fechamentos</dt><dd>{closedClosings.length}</dd></div></dl></Card><Card title="Ações rápidas" description="Atalhos para a rotina"><div className="hr-actions hr-actions--start"><Button size="sm" onClick={() => { setActiveTab('colaboradores'); open('employee'); }}>Novo colaborador</Button><Button size="sm" variant="secondary" onClick={() => setActiveTab('folha')}>Ir para folha</Button><Button size="sm" variant="secondary" onClick={() => setActiveTab('planejamento')}>Ir para planejamento</Button></div></Card></div>
    </div>}

    {activeTab === 'colaboradores' && <div className="hr-overview__content hr-panel hr-panel--people" role="tabpanel">
      <Card className="hr-primary-card" title="Colaboradores" description="Cadastro completo, vínculo, salário, obra e banco de horas" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('employee')}>Novo colaborador</Button><Button size="sm" variant="secondary" onClick={() => open('salary')}>Alterar salário</Button><Button size="sm" variant="secondary" onClick={() => open('allocation')}>Alterar obra</Button><Button size="sm" variant="secondary" onClick={() => open('terminate')}>Encerrar vínculo</Button></div>}>
        <div className="hr-employee-toolbar"><Input label="Buscar" placeholder="Nome, função, obra, setor, CPF…" value={employeeSearch} onChange={(e) => setEmployeeSearch(e.target.value)} /><Select label="Status" value={employeeStatus} onChange={(e) => setEmployeeStatus(e.target.value)} options={[{ value: 'active', label: 'Ativos' }, { value: 'terminated', label: 'Desligados' }, { value: 'all', label: 'Todos' }]} /></div>
        {filteredEmployees.length === 0 ? <p className="ui-muted">Nenhum colaborador encontrado.</p> : <div className="hr-list hr-list--people">{filteredEmployees.map((item) => <div className="hr-list__row hr-employee-row" key={item.employmentContractId}><div className="hr-employee-row__main"><strong>{item.fullName}</strong><span className="ui-muted">{item.jobTitle} · {employmentTypeLabel.get(item.employmentType) ?? item.employmentType} · {item.costCenterName ?? 'Sem obra'}{item.sector ? ` · ${item.sector}` : ''}</span><span className="hr-employee-row__meta">Admissão {item.hiredOn.split('-').reverse().join('/')} · {item.weeklyHours}h/semana{item.bankHoursEnabled ? ' · Banco de horas' : ''}</span></div><div className="hr-list__values hr-employee-row__values"><strong>{currency.format(item.baseSalary)}</strong><span className={`hr-status hr-status--${item.contractStatus}`}>{item.contractStatus === 'active' ? 'Ativo' : 'Desligado'}</span><Button size="sm" variant="tertiary" onClick={() => open('employeeEdit', employeeInitial(item))}>Editar</Button></div></div>)}</div>}
      </Card>
    </div>}

    {activeTab === 'folha' && <div className="hr-overview__content hr-panel hr-panel--payroll" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Eventos ativos"><strong className="hr-kpi">{activeEvents.length}</strong><span className="ui-muted">{currency.format(eventTotal)}</span></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Folha fechada"><strong className="hr-kpi">{currency.format(closingGrossTotal)}</strong><span className="ui-muted">{closedClosings.length} fechamentos</span></Card><Card className="hr-kpi-card" title="Encargos calculados"><strong className="hr-kpi">{currency.format(statutoryTotal)}</strong><span className="ui-muted">INSS + IRRF + FGTS</span></Card></div>
      <Card className="hr-primary-card" title="Operações da folha" description="Eventos → fechamento → encargos → Contas a Pagar" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('event')}>Novo evento</Button><Button size="sm" variant="secondary" onClick={() => open('voidEvent')}>Estornar evento</Button><Button size="sm" variant="secondary" onClick={() => open('closePayroll')}>Fechar folha</Button><Button size="sm" variant="secondary" onClick={() => open('statutory')}>Calcular encargos</Button><Button size="sm" variant="secondary" onClick={() => open('reopen')}>Reabrir</Button><Button size="sm" variant="tertiary" onClick={() => open('financeConfig')}>Configurar financeiro</Button><Button size="sm" variant="tertiary" onClick={() => open('payables')}>Gerar Contas a Pagar</Button></div>}>{(operational?.payrollEvents.length ?? 0) === 0 ? <p className="ui-muted">Nenhum evento lançado nesta competência.</p> : <div className="hr-list hr-list--events">{operational?.payrollEvents.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.employeeName}</strong><span className="ui-muted">{eventLabels[item.eventKind]} · {item.status}</span></div><div className="hr-list__values"><strong>{currency.format(item.amount)}</strong>{item.status === 'active' && <Button size="sm" variant="tertiary" onClick={() => open('voidEvent', { payrollEventId: item.id })}>Estornar</Button>}</div></div>)}</div>}</Card>
      <Card className="hr-secondary-card" title="Fechamentos" description="Bruto, INSS, IRRF e FGTS calculados por colaborador">{(operational?.payrollClosings.length ?? 0) === 0 ? <p className="ui-muted">Nenhum fechamento nesta competência.</p> : <div className="hr-list hr-list--closings">{operational?.payrollClosings.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.employeeName}</strong><span className="ui-muted">{item.status} · Bruto {currency.format(item.grossAmount)}</span></div><div className="hr-list__values"><span>INSS {currency.format(item.inssAmount)}</span><span>IRRF {currency.format(item.irrfAmount)}</span><span>FGTS {currency.format(item.fgtsAmount)}</span></div></div>)}</div>}</Card>
    </div>}

    {activeTab === 'planejamento' && <div className="hr-overview__content hr-panel hr-panel--budget" role="tabpanel">
      <div className="hr-overview__cards"><Card className="hr-kpi-card" title="Planejado no mês"><strong className="hr-kpi">{currency.format(monthlyPlanned)}</strong></Card><Card className="hr-kpi-card" title="Realizado no mês"><strong className="hr-kpi">{currency.format(monthlyRealized)}</strong></Card><Card className="hr-kpi-card hr-kpi-card--primary" title="Disponível no mês"><strong className="hr-kpi">{currency.format(monthlyPlanned - monthlyRealized)}</strong></Card></div>
      <Card className="hr-primary-card" title="Planejamento e limites" description="Manual + salários projetados, por empresa/obra/categoria" actions={<div className="hr-actions"><Button size="sm" onClick={() => open('budgetPlan')}>Planejamento</Button><Button size="sm" variant="secondary" onClick={() => open('budgetLimit')}>Limite</Button></div>}>{monthlyByCostCenter.length === 0 ? <p className="ui-muted">Nenhum orçamento por centro de custo nesta competência.</p> : <div className="hr-list hr-list--budget">{monthlyByCostCenter.map((item) => <div className="hr-list__row" key={item.costCenterId ?? item.costCenterName ?? 'cc'}><strong>{item.costCenterName ?? 'Centro de custo'}</strong><div className="hr-list__values"><span>Prev. {currency.format(item.plannedTotal)}</span><span>Real. {currency.format(item.realizedTotal)}</span><span>Saldo {currency.format(item.varianceAmount)}</span></div></div>)}</div>}</Card>
      <Card className="hr-secondary-card" title="Limites cadastrados" description="Alerta por obra e categoria">{(operational?.budgetLimits.length ?? 0) === 0 ? <p className="ui-muted">Nenhum limite cadastrado para esta competência.</p> : <div className="hr-list hr-list--limits">{operational?.budgetLimits.map((item) => <div className="hr-list__row" key={item.id}><div><strong>{item.costCenterName ?? 'Empresa geral'}</strong><span className="ui-muted">{item.categoryName ?? 'Todas as categorias'} · alerta {item.warningPercent}%</span></div><strong>{currency.format(item.limitAmount)}</strong></div>)}</div>}</Card>
      <Card className="hr-annual-card" title="Consolidado anual"><dl className="hr-summary"><div><dt>Previsto</dt><dd>{currency.format(annualPlanned)}</dd></div><div><dt>Realizado</dt><dd>{currency.format(annualRealized)}</dd></div><div><dt>Saldo</dt><dd>{currency.format(annualPlanned - annualRealized)}</dd></div></dl></Card>
    </div>}

    <Dialog open={modal !== null} title={modal ? modalTitles[modal] : 'RH'} description="Operação vinculada exclusivamente à empresa e competência selecionadas." loading={operations.state.busy} onClose={close} onBack={close} onConfirm={modal ? () => { void submitModal(); } : undefined}>{operations.state.errorMessage && <Feedback tone="danger" title="Não foi possível salvar" message={operations.state.errorMessage} />}{modalContent}</Dialog>
  </section>;
}
