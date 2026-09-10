# Auditoria comparativa — Gestão 2.0 x Gestão 3.0

## Objetivo
Elevar o Gestão 3.0 ao mesmo nível funcional do Gestão 2.0 ou superior, preservando a arquitetura modular, o design system e a separação por domínio do Gestão 3.0.

## Regra principal
Nenhuma funcionalidade do Gestão 3.0 é considerada concluída enquanto estiver abaixo do comportamento equivalente do Gestão 2.0. Divergências só são aceitas quando representarem melhoria comprovada.

## Classificação
- **MANTER 3.0**: arquitetura/fluxo do 3.0 é superior e deve permanecer.
- **COPIAR 2.0**: UX/fluxo do 2.0 é superior e deve ser reproduzido no 3.0 usando componentes e arquitetura do 3.0.
- **PARIDADE**: trazer regras maduras do 2.0 para o domínio/repository do 3.0.
- **REESTRUTURAR**: regra atual do 3.0 está concentrada na UI ou depende de inferências frágeis e deve ser movida para fonte oficial de dados/domínio.
- **VALIDAR**: estrutura parece correta, mas o fluxo real precisa ser testado ponta a ponta.

# Matriz 00 — Navegação, rotas e páginas

Regra desta matriz: uma rota só é considerada funcional quando abre o módulo correto. Renderizar componente de outro módulo ou uma página genérica de reconstrução é falha estrutural, mesmo que não haja erro de navegação.

| Entrada do menu 3.0 | Rota 3.0 | Referência 2.0 | Situação 3.0 | Classificação | Ação alvo |
|---|---|---|---|---|---|
| Lançamentos | `/financeiro?tab=lancamentos` | `TransactionsPage` | Página real dentro do workspace financeiro | VALIDAR | Conferir paridade de cadastro/edição/empresa/parcelamento |
| Contas do mês | `/contas-do-mes` | `AccountsPage` | Página real | VALIDAR | Conferir vencidas, parcial, pago e atualização de saldo |
| Bancos | `/bancos` | `BanksPage` | Página real | COPIAR 2.0 + MANTER 3.0 | Recuperar produtividade/clareza do 2.0 sem perder arquitetura nova |
| Cartões | `/cartoes` | `CardsPage` | Página real | VALIDAR | Conferir faturas, parcelamento, histórico e impressão |
| Limites | `/limites` | `BudgetsPage` | Duplicava Orçamento no 3.0 | REMOVER MENU | Não expor como módulo separado; manter compatibilidade temporária de rota |
| Dashboard financeiro | `/financeiro?tab=resumo` | `DashboardPage` | Página real dentro do workspace | VALIDAR | Conferir indicadores e filtros reais |
| Contratos | `/engenharia` | `MeasurementsPage` + fluxos de engenharia evoluídos | Página real | MANTER 3.0 + PARIDADE | Preservar arquitetura nova e recuperar funções maduras |
| Produção | `/producao` | `ProductionPage` | Tinha rota própria, mas reutilizava página de Engenharia/Medição | REESTRUTURAR | Página dedicada; compartilhar dados de obra/contrato, não a navegação de Medição |
| Orçamentos Engenharia | `/orcamentos` | Fluxo comercial/orçamentário legado | Página real | VALIDAR | Confirmar persistência, impressão, observações e totais |
| Recursos Humanos | `/rh` | `HrModulePage` | Página real | PARIDADE | Consolidar RH operacional/financeiro conforme escopo 3.0 |
| Central de relatórios | `/relatorios` | `ReportsPage` | Placeholder | COPIAR 2.0 + REESTRUTURAR | Criar página real de relatórios com fontes 3.0 |
| Usuários e permissões | `/usuarios` | `UsersPage` | Placeholder | PARIDADE | Reconstruir usuários, perfis, permissões por módulo/empresa |
| Empresas do tenant | `/empresas` | Evolução SaaS do 3.0 | Placeholder | MANTER 3.0 | Implementar gestão real de empresas do tenant |
| Cadastros e configurações | `/configuracoes` | `SettingsPage` | Placeholder | COPIAR 2.0 + MANTER 3.0 | Recriar configurações usando DS e estrutura 3.0 |
| Clientes atendidos | `/clientes` | Cadastros distribuídos do 2.0 | Placeholder | REESTRUTURAR | Consolidar cadastro real, sem criar tela vazia |
| Minhas empresas | `/minhas-empresas` | Evolução multiempresa do 3.0 | Placeholder | MANTER 3.0 | Implementar sobre tenant/company reais |
| Auditoria | `/auditoria` | `AuditPage` | Placeholder | PARIDADE | Recuperar rastreabilidade funcional e adaptar ao modelo 3.0 |
| Saúde do sistema | `/sistema` | `SystemHealthPage` | Placeholder | COPIAR 2.0 + MANTER 3.0 | Reconstruir diagnóstico real do ambiente 3.0 |
| Clientes SaaS e permissões | `/clientes-saas` | Evolução SaaS do 3.0 | Placeholder | MANTER 3.0 | Implementar somente com dados reais e permissões reais |
| Planos e módulos | `/planos-modulos` | Evolução SaaS do 3.0 | Placeholder | MANTER 3.0 | Implementar catálogo/ativação real por cliente |
| Acertos pessoais | `/acertos-pessoais` | `PersonalSettlementsPage` | Placeholder | COPIAR 2.0 + PARIDADE | Reconstruir página funcional e integração bancária |

## Achados críticos — Navegação

### N01 — Limites duplicado com Orçamento
No 3.0, `/limites` renderizava o mesmo `BudgetWorkspacePage` de Orçamento. Como Orçamento passou a concentrar o planejamento, a entrada `Limites` foi removida do menu central. A rota antiga deve permanecer apenas enquanto houver necessidade de compatibilidade com links salvos.

**Critério de aceite:** usuário não vê duas entradas diferentes levando ao mesmo módulo.

### N02 — Produção renderizando fluxo de Engenharia/Medição
No 3.0, `/engenharia` e `/producao` apontavam para `EngineeringPageDashboard`. Isso permitia que elementos de Medição/Engenharia fossem exibidos em Produção. A Produção possui banco e componentes próprios e deve ter entrada de página dedicada.

**Critério de aceite:** clicar em Produção nunca abre Medição nem dashboard geral de Engenharia; após selecionar obra, o usuário acessa exclusivamente competências, lançamentos, colaboradores, fechamento/reabertura e relatórios de Produção.

### N03 — Placeholder não é página funcional
`ModuleRecoveryPage` é apenas sinalização de reconstrução. Rotas que ainda o utilizam devem permanecer classificadas como incompletas.

**Critério de aceite:** nenhuma rota de menu é dada como concluída enquanto renderizar `ModuleRecoveryPage`.

### N04 — Não reconstruir SaaS copiando legado
Empresas do tenant, Minhas empresas, Clientes SaaS e Planos/módulos são capacidades estruturais do 3.0. O 2.0 pode servir de referência de UX onde aplicável, mas a fonte de verdade precisa ser tenant/company/permissões do 3.0.

# Matriz 01 — Engenharia / Medição

| Área / função | Gestão 2.0 | Gestão 3.0 | Classificação | Ação alvo |
|---|---|---|---|---|
| Arquitetura do módulo | Legado acumulado | Modular por domínio/aplicação/infra/UI | MANTER 3.0 | Não retornar ao legado |
| Obra e estrutura física | Funcional | `works` + `work_structures` hierárquico | MANTER 3.0 | Usar estrutura cadastrada como fonte oficial |
| Contratos | Maduro | `engineering_contracts` | MANTER 3.0 + PARIDADE | Preservar estrutura nova e trazer comportamento faltante |
| Serviços contratuais | Maduro | `contract_services` + catálogo mestre | MANTER 3.0 + PARIDADE | Consolidar regras do 2.0 |
| Distribuição por torre/pavimento/unidade | Funcional | `contract_service_allocations` | REESTRUTURAR | Nenhuma regra de torre deve ser inferida na UI |
| Tela de medição consolidada | Muito madura | Reconstruída no `GuidedMeasurementFlow` | COPIAR 2.0 | Reproduzir fluxo/UX do 2.0 com DS 3.0 |
| Seleção de origem (torre/aditivo) | Maduro | Existe | VALIDAR | Garantir isolamento correto por medição |
| Seleção de serviços | Maduro | Regressões observadas | COPIAR 2.0 + PARIDADE | Garantir 100% dos serviços e persistência |
| Seleção de unidades | Maduro | Regressões observadas | REESTRUTURAR | Ler unidades reais de `work_structures`/escopo oficial |
| Quantidade por pavimento | Configuração explícita | Há inferências no frontend | REESTRUTURAR | Remover heurísticas específicas por torre |
| Térreo | Maduro | Há lógica específica no fluxo | REESTRUTURAR | Estrutura física oficial deve definir térreo/unidades |
| Saldo por serviço | Regras maduras | Derivado no novo fluxo | PARIDADE | Reproduzir todas as regras do 2.0 no domínio/banco |
| Bloqueio de unidades já medidas | Maduro | Existe no frontend | PARIDADE | Garantir também no banco/RPC |
| Aditivos | Maduro | Nova estrutura rastreável | MANTER 3.0 + PARIDADE | Completar medição por unidade/percentual/valor |
| Retrabalho | Implementado e reportável | Equivalência não comprovada | COPIAR 2.0 + PARIDADE | Implementar sem consumir novamente saldo contratado |
| Retenções INSS/ISS/RT | Maduro | Modelo correto | VALIDAR | Conferir cálculo, fechamento, relatório e integração |
| Fechamento | Maduro | Previsto com snapshot | VALIDAR | Teste ponta a ponta |
| Reabertura | Existente | Modelo conceitualmente superior | MANTER 3.0 + VALIDAR | Exigir motivo/auditoria e preservar histórico |
| Integração contas a receber | Madura | Prevista | PARIDADE + VALIDAR | Idempotência e ausência de duplicidade |
| Relatório de medição | Muito refinado | Recebeu vários patches | COPIAR 2.0 | Reproduzir conteúdo/legibilidade e manter identidade 3.0 |
| Responsividade | Refinada ao longo do uso | Design system melhor, execução irregular | COPIAR 2.0 + MANTER 3.0 | UX do 2.0 + componentes 3.0 |
| Permissões | Regras acumuladas | Tenant/company obrigatório | MANTER 3.0 + PARIDADE | Preservar isolamento e reproduzir permissões funcionais |

## Achados críticos — Engenharia/Medição

### E01 — Geração/inferência de unidades na UI
O `GuidedMeasurementFlow` atualmente calcula referências de unidades com heurísticas de quantidade contratada, pavimentos, térreo e até tratamento específico pelo nome da Torre 4. Isso não deve ser fonte oficial. A lista de unidades precisa vir da estrutura física cadastrada e do escopo contratual.

**Destino:** REESTRUTURAR.

### E02 — Persistência de seleção de serviços/unidades
O fluxo atual salva por `replaceMeasurementParityStage(...)`, recarrega e compara a quantidade persistida. A conferência é positiva, mas os relatos de seleção não registrada e serviços faltantes mostram que a paridade precisa ser auditada na camada de carregamento/persistência e não apenas na UI.

**Destino:** PARIDADE + validação ponta a ponta.

### E03 — Medição 0003 com serviços incompletos
Tratar como caso de regressão obrigatório: quantidade de serviços gravados deve ser igual à quantidade apresentada para a mesma medição/origem, sem truncamento, paginação implícita ou filtro indevido.

**Critério de aceite:** 13 gravados = 13 carregados = 13 exibidos.

### E04 — Torre 6 / Confirmar seleção
Tratar como caso de regressão obrigatório.

**Critério de aceite:** selecionar unidades → confirmar → persistir → recarregar → mesmas unidades permanecem selecionadas e contabilizadas.

## Decisão visual — Medição
A Medição Consolidada do Gestão 2.0 será usada como referência funcional e de composição visual onde for superior. O código não será copiado diretamente. O Gestão 3.0 deve usar seus próprios componentes compartilhados, modal fullscreen, design system e arquitetura modular.

## Próximas matrizes
1. Engenharia — Contratos / Planilhas / Aditivos / Fechamentos / Produção
2. Financeiro — Home / Planejamento / Contas do mês / Entradas / Despesas
3. Bancos / Transferências
4. Cartões / Faturas
5. Orçamento
6. RH Operacional / RH Financeiro
7. Dashboards / Relatórios / Permissões / PWA

## Critérios globais de aceite
- Paridade funcional mínima com o Gestão 2.0.
- Nenhuma perda de dados em edição/salvamento.
- Nenhuma tela mostrar subconjunto incorreto do que está persistido.
- Isolamento por tenant + empresa + contexto funcional.
- Fluxos críticos testados após recarregar a página.
- Responsividade validada em celular e desktop.
- Regras críticas no domínio/banco, não dependentes apenas da UI.
- Visual pode ser igual ou melhor que o 2.0, nunca inferior em clareza ou produtividade.
