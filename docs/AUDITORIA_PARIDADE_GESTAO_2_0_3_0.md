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
