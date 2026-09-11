import type { CompanySummary } from '../../platform/domain/AccessContext';
import { EngineeringPage } from './EngineeringPage';

interface EngineeringProductionPageProps {
  companies: readonly CompanySummary[];
  initialCompanyId?: string;
}

/**
 * Entrada dedicada do módulo Produção.
 *
 * A Produção compartilha contratos/obras da Engenharia, mas possui fluxo próprio.
 * Manter esta página separada evita que dashboard/medição sejam renderizados
 * acidentalmente quando o usuário acessa /producao.
 */
export function EngineeringProductionPage({ companies, initialCompanyId }: EngineeringProductionPageProps) {
  return <EngineeringPage companies={companies} {...(initialCompanyId ? { initialCompanyId } : {})} />;
}
