# RH + Orçamento — Gestão 3.0

## Princípios

- Construção do zero; Gestão 2.0 é somente referência de regra de negócio e futura fonte controlada de migração.
- Isolamento estrutural: `tenant_id` → `company_id` → obra/centro de custo → colaborador.
- Fechamentos e cálculos críticos são auditáveis, idempotentes e executados com precisão decimal no banco.
- Regras legais são versionadas por competência.
- Previsto × Realizado orçamentário é separado de fluxo de caixa.
- UI nunca acessa Supabase diretamente; usa repositórios/casos de uso.
- Componentes visuais reutilizam exclusivamente o Design System compartilhado.

## Modelo

O domínio RH/orçamento é composto por `employees`, `employment_contracts`, `employee_allocations`, `compensation_terms`, `payroll_events`, `payroll_closings`, snapshots de fechamento, cálculos estatutários, vínculos financeiros e planejamento orçamentário.

## Regras consolidadas

- Salário previsto nasce automaticamente da remuneração vigente e da alocação vigente.
- Realizado salarial nasce de fechamento mensal concluído, usando snapshot histórico.
- Faltas e DSR entram como deduções conforme classificação de incidência validada.
- INSS, IRRF e FGTS usam regras versionadas por competência.
- FGTS, INSS retido e IRRF podem ser consolidados por empresa + competência no Contas a Pagar; salário líquido permanece individualizado.
- Sincronização com Contas a Pagar é idempotente e bloqueia alteração silenciosa de obrigação já paga/parcial.
- Orçamento mensal combina planejamento manual + salário previsto.
- Realizado orçamentário combina financeiro + folha fechada, excluindo lançamentos financeiros gerados pela própria folha para impedir dupla contagem.
- Consolidado anual deriva das competências mensais.

## Auditoria 5.10

Regressão integrada validada em banco real dentro de `BEGIN ... ROLLBACK`:

- salário-base: R$ 2.300,00;
- hora extra: R$ 200,00;
- falta: R$ 100,00;
- DSR: R$ 50,00;
- adiantamento: R$ 300,00;
- bruto: R$ 2.500,00;
- líquido antes dos descontos estatutários: R$ 2.050,00;
- base INSS/FGTS: R$ 2.350,00;
- INSS: R$ 187,19;
- FGTS: R$ 188,00;
- IRRF: R$ 0,00;
- salário líquido para Contas a Pagar: R$ 1.862,81;
- orçamento de setembro: Previsto R$ 3.300,00, Realizado R$ 2.900,00, Variância R$ 400,00;
- cenário anual: Previsto R$ 21.700,00, Realizado R$ 2.900,00, Variância R$ 18.800,00.

A auditoria também corrigiu a visibilidade de `employees`: um usuário só enxerga colaborador se for tenant admin ou tiver acesso a alguma empresa vinculada ao colaborador.

## Integração ao shell — 5.11

O módulo RH + Orçamento está conectado à rota `/rh` do shell oficial sem publicação de ambiente.

Arquitetura frontend:

- `src/modules/hr/application/HrBudgetRepository.ts` define o contrato da aplicação;
- `src/modules/hr/infrastructure/SupabaseHrBudgetRepository.ts` concentra RPCs e mapeamento de dados;
- `src/modules/hr/infrastructure/createHrRepositories.ts` resolve dependências;
- `src/modules/hr/ui/useHrBudgetOverview.ts` coordena carregamento e estado;
- `src/modules/hr/ui/HrBudgetPage.tsx` apresenta os dados;
- `src/modules/hr/ui/hr.css` contém somente composição responsiva do módulo;
- `src/app/AppShell.tsx` injeta a empresa ativa autorizada.

A tela reutiliza `Card`, `Tabs`, `LoadingState` e `EmptyState` compartilhados. As abas `RH` e `Orçamento` trocam conteúdo na mesma tela e seguem o padrão oficial já congelado. O resumo de RH mostra salário previsto, realizado e vínculos projetados; o orçamento mostra planejado, realizado, disponível, detalhamento por obra/centro de custo e consolidado anual.

Os KPIs de orçamento usam a linha consolidada da empresa quando disponível e não somam novamente linhas por centro de custo, evitando dupla contagem visual. O contador de vínculos também considera contratos únicos mesmo quando há rateio por mais de um centro de custo.

CI final da etapa: #199 aprovado em Typecheck + Lint + Test + Build.

Nenhum deploy, preview público ou ambiente de homologação foi criado nesta etapa.
