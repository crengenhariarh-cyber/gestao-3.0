import { useMemo, useState } from 'react';
import { BarChart3, CalendarCheck, Clock3, FileText, FolderUp, HardHat, ReceiptText, ShieldCheck, Upload, UsersRound, WalletCards } from 'lucide-react';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Input } from '../../../shared/ui/Input';
import { Select } from '../../../shared/ui/Select';
import { currentHrCompetence, useHrBudgetOverview } from './useHrBudgetOverview';
import { useHrOperations } from './useHrOperations';
import './hr-workspace.css';

type HrWorkspaceTab = 'dashboard' | 'colaboradores' | 'epis' | 'compliance' | 'salarios' | 'presenca' | 'banco_horas' | 'fechamento' | 'relatorios' | 'recibos' | 'importacoes' | 'documentos';

const tabs: Array<{ id: HrWorkspaceTab; label: string; icon: typeof BarChart3 }> = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'colaboradores', label: 'Colaboradores', icon: UsersRound },
  { id: 'epis', label: 'EPIs', icon: HardHat },
  { id: 'compliance', label: 'ASO, NR e Férias', icon: ShieldCheck },
  { id: 'salarios', label: 'Salários e pagamentos', icon: WalletCards },
  { id: 'presenca', label: 'Presença e ponto', icon: CalendarCheck },
  { id: 'banco_horas', label: 'Banco de horas', icon: Clock3 },
  { id: 'fechamento', label: 'Fechamento quinzenal', icon: WalletCards },
  { id: 'relatorios', label: 'Relatórios', icon: FileText },
  { id: 'recibos', label: 'Recibos', icon: ReceiptText },
  { id: 'importacoes', label: 'Importações', icon: Upload },
  { id: 'documentos', label: 'Importações RH', icon: FolderUp },
];

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function HrWorkspacePage({ company }: { company: CompanySummary }) {
  const [tab, setTab] = useState<HrWorkspaceTab>('dashboard');
  const [competence, setCompetence] = useState(() => currentHrCompetence().month.slice(0, 7));
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState('active');
  const competenceMonth = `${competence}-01`;
  const scope = useMemo(() => ({ tenantId: company.tenantId, companyId: company.id }), [company.id, company.tenantId]);
  const overview = useHrBudgetOverview(scope, 0, competenceMonth);
  const operations = useHrOperations(scope, competenceMonth);
  const operational = operations.state.data;
  const employees = operational?.employees ?? [];
  const activeEmployees = employees.filter((item) => item.contractStatus === 'active');
  const filteredEmployees = employees.filter((item) => {
    if (employeeStatus !== 'all' && item.contractStatus !== employeeStatus) return false;
    const q = employeeSearch.trim().toLocaleLowerCase('pt-BR');
    return !q || [item.fullName, item.jobTitle, item.costCenterName, item.cpf, item.sector].some((value) => value?.toLocaleLowerCase('pt-BR').includes(q));
  });
  const salaryPlanned = overview.data?.salaryProjection.reduce((total, item) => total + item.plannedSalary, 0) ?? 0;
  const salaryRealized = overview.data?.salaryProjection.reduce((total, item) => total + item.realizedSalary, 0) ?? 0;
  const works = new Set(activeEmployees.map((item) => item.costCenterId).filter(Boolean)).size;
  const bankHours = activeEmployees.filter((item) => item.bankHoursEnabled).length;
  const eventTotal = (operational?.payrollEvents ?? []).filter((item) => item.status === 'active').reduce((total, item) => total + item.amount, 0);

  const commonCompetence = <Input label="Competência" type="month" value={competence} onChange={(event) => setCompetence(event.target.value)} />;
  const employeeOptions = [{ value: '', label: 'Selecione o colaborador' }, ...activeEmployees.map((item) => ({ value: item.employmentContractId, label: item.fullName }))];

  return <section className="hr-workspace">
    <Card className="hr-workspace__hero" title="RH" actions={<Button onClick={() => setTab('colaboradores')}>＋ Novo colaborador</Button>} />

    <nav className="hr-workspace__tabs" aria-label="Módulos do RH">
      {tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>

    {tab === 'dashboard' && <div className="hr-workspace__content">
      <Card title="Painel financeiro do RH" description={`${activeEmployees.length} colaboradores ativos`}><div className="hr-workspace__primary-total"><span>Total da competência</span><strong>{money.format(salaryRealized)}</strong><small>Previsto {money.format(salaryPlanned)}</small></div></Card>
      <div className="hr-workspace__kpis"><Card title="Colaboradores ativos"><strong>{activeEmployees.length}</strong><span className="ui-muted">Base disponível para lançamentos</span></Card><Card title="Pagamentos"><strong>{money.format(salaryRealized)}</strong><span className="ui-muted">Competência atual</span></Card><Card title="Extras e reembolsos"><strong>{money.format(eventTotal)}</strong><span className="ui-muted">Eventos ativos</span></Card><Card title="Média por colaborador"><strong>{money.format(activeEmployees.length ? salaryRealized / activeEmployees.length : 0)}</strong><span className="ui-muted">Valor realizado</span></Card></div>
    </div>}

    {tab === 'colaboradores' && <div className="hr-workspace__content">
      <Card title="Colaboradores"><div className="hr-workspace__kpis hr-workspace__kpis--small"><Card title="Total"><strong>{employees.length}</strong></Card><Card title="Ativos"><strong>{activeEmployees.length}</strong></Card><Card title="Obras"><strong>{works}</strong></Card><Card title="Banco de horas"><strong>{bankHours}</strong></Card></div></Card>
      <Card><div className="hr-workspace__filters"><Input label="Buscar" placeholder="Pesquisar nome, CPF, empresa ou obra" value={employeeSearch} onChange={(event) => setEmployeeSearch(event.target.value)} /><Select label="Status" value={employeeStatus} onChange={(event) => setEmployeeStatus(event.target.value)} options={[{ value: 'active', label: 'Ativos' }, { value: 'terminated', label: 'Desligados' }, { value: 'all', label: 'Todos' }]} /></div>{filteredEmployees.length === 0 ? <p className="ui-muted">Nenhum colaborador encontrado.</p> : <div className="hr-workspace__list">{filteredEmployees.map((item) => <div key={item.employmentContractId}><div><strong>{item.fullName}</strong><span>{item.jobTitle} · {item.costCenterName ?? 'Sem obra'}</span></div><div><strong>{money.format(item.baseSalary)}</strong><span>{item.contractStatus === 'active' ? 'Ativo' : 'Desligado'}</span></div></div>)}</div>}</Card>
    </div>}

    {tab === 'epis' && <div className="hr-workspace__content"><div className="hr-workspace__quick-three"><Card title="Histórico de entregas"><Clock3/></Card><Card title="Cadastro de EPIs"><HardHat/></Card><Card title="Fichas de EPIs"><FolderUp/></Card></div><Card title="Entrega de EPI"><div className="hr-workspace__form"> <Select label="Colaborador" options={employeeOptions}/><Input label="EPI" placeholder="Selecione ou informe o EPI"/><Input label="Quantidade" type="number" min="1" defaultValue="1"/><Input label="Data da entrega" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><Button>Registrar entrega</Button></div></Card></div>}

    {tab === 'compliance' && <div className="hr-workspace__content"><Card title="Saúde, segurança e férias" actions={<Button>＋ Novo registro</Button>}><div className="hr-workspace__segment"><Button variant="secondary">ASO</Button><Button variant="secondary">NRs e treinamentos</Button><Button variant="secondary">Férias</Button></div><div className="hr-workspace__empty">Nenhum registro nesta área.</div></Card></div>}

    {tab === 'salarios' && <div className="hr-workspace__content"><Card title="Salário e Contas a Pagar"><div className="hr-workspace__form">{commonCompetence}<Select label="Colaborador" options={employeeOptions}/><Input label="Salário / valor" value={salaryPlanned ? String(salaryPlanned) : ''} readOnly/><div className="hr-workspace__actions"><Button>Gerar pagamento</Button><Button variant="secondary">Configurar encargos</Button></div></div></Card></div>}

    {tab === 'presenca' && <div className="hr-workspace__content"><Card title="Presença e ponto" actions={<Button variant="secondary">Registrados</Button>}><div className="hr-workspace__form"><Input label="Data" type="date" defaultValue={new Date().toISOString().slice(0,10)}/><Button>Marcar todos presentes</Button><Button variant="secondary">PDF empresa</Button><Select label="Relatório individual" options={employeeOptions}/></div></Card></div>}

    {tab === 'banco_horas' && <div className="hr-workspace__content"><Card title="Banco de horas"><div className="hr-workspace__form">{commonCompetence}<Input label="Empresa" value={company.tradeName ?? company.legalName} readOnly/><Input label="Buscar colaborador" placeholder="Digite a inicial ou parte do nome"/><Select label="Colaborador" options={employeeOptions}/><div className="hr-workspace__actions"><Button>Registrar movimento</Button><Button variant="secondary">Fechar competência</Button></div></div></Card></div>}

    {tab === 'fechamento' && <div className="hr-workspace__content"><Card title="Fechamento quinzenal"><div className="hr-workspace__form">{commonCompetence}<Select label="Quinzena" options={[{ value: '1', label: '1ª quinzena' }, { value: '2', label: '2ª quinzena' }]}/><Input label="Empresa" value={company.tradeName ?? company.legalName} readOnly/><Select label="Colaborador" options={employeeOptions}/><div className="hr-workspace__actions"><Button>Apurar</Button><Button variant="secondary">Fechar quinzena</Button></div></div></Card></div>}

    {tab === 'relatorios' && <div className="hr-workspace__content"><Card title="Relatórios do RH"><div className="hr-workspace__form"><Select label="Modelo" options={[{ value: 'detalhado', label: 'Relatório detalhado por colaborador' }, { value: 'consolidado', label: 'Consolidado por empresa' }, { value: 'banco', label: 'Banco de horas' }]}/><Input label="Competência inicial" type="month" value={competence} onChange={(event) => setCompetence(event.target.value)}/><Input label="Competência final" type="month" value={competence} readOnly/><Button>Gerar relatório</Button></div></Card></div>}

    {tab === 'recibos' && <div className="hr-workspace__content"><Card title="Recibos" description="Selecione empresa, colaborador e verbas para gerar ou imprimir."><div className="hr-workspace__form">{commonCompetence}<Select label="Quinzena" options={[{ value: 'all', label: 'Todas' }, { value: '1', label: '1ª quinzena' }, { value: '2', label: '2ª quinzena' }]}/><Input label="Empresa" value={company.tradeName ?? company.legalName} readOnly/><Select label="Colaborador" options={employeeOptions}/><div className="hr-workspace__actions"><Button>Gerar recibo</Button><Button variant="secondary">Imprimir</Button></div></div></Card></div>}

    {tab === 'importacoes' && <div className="hr-workspace__content"><Card title="Importação" description="Modelos CSV separados por ponto e vírgula."><div className="hr-workspace__upload"><label>Importar colaboradores<input type="file" accept=".csv,text/csv"/></label><label>Importar fechamento quinzenal<input type="file" accept=".csv,text/csv"/></label><label>Importar banco de horas<input type="file" accept=".csv,text/csv"/></label></div></Card></div>}

    {tab === 'documentos' && <div className="hr-workspace__content"><Card title="Importações RH" description="Holerites e documentos separados por módulo"><div className="hr-workspace__form"><label className="hr-workspace__file">Escolher arquivo<input type="file"/></label><Button>Importar documento RH</Button><p className="ui-muted">Nenhum documento RH importado.</p></div></Card></div>}
  </section>;
}
