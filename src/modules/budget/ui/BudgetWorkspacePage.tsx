import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CompanySummary } from '../../platform/domain/AccessContext';
import { HrBudgetPage } from '../../hr/ui/HrBudgetPage';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Select } from '../../../shared/ui/Select';
import './budget-workspace.css';

function companyLabel(company: CompanySummary): string {
  const raw = `${company.tradeName ?? ''} ${company.legalName}`.toLocaleUpperCase('pt-BR');
  if (raw.includes('SARTORI')) return 'Sartori';
  if (raw.includes('PESSOAL')) return 'Pessoal';
  if (raw.includes('PR-HIST') || /(^|\s)PR(\s|$)/.test(raw)) return 'PR';
  if (raw.includes('CR-HIST') || /(^|\s)CR(\s|$)/.test(raw)) return 'CR';
  return company.tradeName ?? company.legalName;
}

export function BudgetWorkspacePage({ companies, initialCompanyId }: { companies: readonly CompanySummary[]; initialCompanyId?: string | undefined }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = initialCompanyId && companies.some((company) => company.id === initialCompanyId) ? initialCompanyId : companies[0]?.id ?? '';
  const [companyId, setCompanyId] = useState(initial);
  const company = useMemo(() => companies.find((item) => item.id === companyId) ?? companies[0], [companies, companyId]);

  useEffect(() => {
    if (searchParams.get('tab') === 'planejamento') return;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'planejamento');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!company) return null;

  return <section className="budget-workspace" aria-label="Orçamento">
    <PageHeader
      title="Orçamento"
      eyebrow="Planejamento financeiro"
      description="Crie e acompanhe o orçamento mensal da empresa selecionada, com previsto, realizado e resultado."
      actions={<Select label="Empresa" value={company.id} onChange={(event) => setCompanyId(event.target.value)} options={companies.map((item) => ({ value: item.id, label: companyLabel(item) }))} />}
    />
    <div className="budget-workspace__legacy-planning">
      <HrBudgetPage company={company} />
    </div>
  </section>;
}
