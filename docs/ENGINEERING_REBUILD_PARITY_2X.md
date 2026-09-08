# Reconstrução do módulo Engenharia — paridade Gestão 2.0

## Objetivo
Reconstruir a camada funcional e visual da Engenharia do Gestão 3.0 usando o Gestão 2.0 como baseline de usabilidade, regras e métricas, preservando a arquitetura modular do 3.0 e todos os dados já lançados.

## Regra principal: zero perda de dados
A reconstrução não deve apagar, renumerar nem recriar registros existentes sem necessidade. As tabelas atuais continuam sendo a fonte de verdade. Alterações de schema, se necessárias, serão apenas aditivas ou migradas de forma controlada, sempre com validação antes/depois.

## Dados protegidos
- works
- work_structures
- engineering_contracts
- contract_services
- contract_service_allocations
- provisional_contracts / provisional_contract_lines
- contract_addenda / contract_addendum_lines
- measurements / measurement_lines
- measurement_retentions
- engineering_contract_retention_rules
- engineering_measurement_origin_profiles
- engineering_measurement_service_scopes
- engineering_production_periods / engineering_production_entries
- relatórios, métricas e vínculos derivados desses registros

## Baseline atual do banco
- 5 obras
- 6 estruturas físicas
- 4 contratos
- 121 serviços de contrato
- 102 alocações físicas de serviços
- 1 contrato provisório / 147 linhas provisórias
- 9 aditivos / 33 linhas de aditivo
- 10 medições / 1.328 linhas de medição
- 26 retenções de medição
- 1 período de produção / 224 lançamentos de produção
- 11 perfis de origem de medição
- 26 escopos de serviço de medição

Essas contagens devem ser usadas como checkpoint de preservação durante a reconstrução.

## Direção de produto
1. Gestão 2.0 = referência de fluxo, simplicidade, métricas, organização de telas e comportamento.
2. Gestão 3.0 = referência de arquitetura, design system, segurança, separação application/domain/infrastructure/ui e responsividade.
3. Código do 2.0 não será simplesmente copiado; o comportamento será reimplementado na arquitetura do 3.0.
4. Quando a tela do 2.0 for superior, reproduzir sua composição e fluxo, modernizando apenas acabamento e responsividade.
5. Nenhuma nova correção será considerada definitiva se depender de script de patch executado no CI.

## Escopo funcional a reconstruir
### Obras e estruturas
- cadastro e visão de obra
- torres/blocos/pavimentos/unidades/casas
- navegação simples e direta
- edição da estrutura sem esconder regras em heurísticas de frontend

### Contratos e planilhas
- contrato por obra
- separação visual por torre/bloco/aditivo
- serviços e quantitativos
- edição rápida de quantidade e valor
- importação de planilha
- filtros progressivos
- saldo contratado/medido/restante

### Aditivos e provisórios
- criação e edição
- medição por unidade, quantidade, percentual ou valor conforme configuração
- vínculo claro com contrato e origem
- rastreabilidade sem duplicar informação

### Medições
- fluxo inspirado no 2.0
- seleção simples da origem
- lista clara de serviços
- seleção de apartamentos/unidades em tela cheia
- serviços já lançados visíveis e editáveis em rascunho
- saldos e progresso visíveis
- fechamento, reabertura e histórico
- retenções e líquido
- impressão/PDF

### Produção
- lançamento por colaborador/obra/torre/pavimento/unidade/serviço
- divisão entre colaboradores
- fechamento mensal e reabertura
- relatórios por colaborador, torre e obra
- preservação dos 224 lançamentos atuais

### Indicadores e relatórios
- contratado
- medido
- saldo
- % contratado / % medido
- evolução física e financeira
- retenções
- produção
- relatórios por torre, contrato, aditivo, medição e colaborador

## Estratégia técnica
### Fase A — congelar baseline
- mapear todas as telas e funções do 2.0
- mapear os equivalentes do 3.0
- registrar contagens e totais atuais do banco
- não alterar dados de produção durante a reconstrução estrutural

### Fase B — camada de leitura nova
Criar queries/repositories consolidados que leiam as tabelas atuais sem patches de transformação no build. As telas novas devem depender dessa camada única.

### Fase C — telas novas com UX do 2.0
Reconstruir as telas por domínio, mantendo design system do 3.0 e fluxo do 2.0. Prioridade: visão geral > contratos/planilhas > medição > produção > relatórios.

### Fase D — escrita e regras
Centralizar gravações em application/infrastructure e no banco. Remover lógica crítica de componentes React. Saldo, bloqueios, status e consistência ficam no domínio/RPC/DB, não em heurísticas da UI.

### Fase E — remoção de remendos
Depois de cada fluxo estar coberto por testes e integrado ao código-fonte definitivo, remover scripts fix-* e apply-* correspondentes do CI. O deploy final não deve modificar código antes de compilar.

### Fase F — validação de preservação
Comparar contagens, somatórios e IDs antes/depois. Nenhuma migração entra em produção se reduzir registros ou alterar histórico sem regra explícita.

## Critérios de aceite do módulo
- fazer no máximo o mesmo número de etapas do 2.0 para a mesma tarefa, preferencialmente menos
- nenhuma funcionalidade relevante do 2.0 ausente
- telas principais reconhecíveis e simples para quem já usava o 2.0
- nenhuma regra crítica escondida em patch de CI
- nenhum dado histórico perdido
- typecheck, lint, testes e build limpos
- testes end-to-end para contratos, aditivos, medições e produção
- responsividade celular/tablet/desktop

## Ordem de execução
1. Visão geral da Engenharia
2. Contratos e planilhas
3. Aditivos/provisórios
4. Medições
5. Produção
6. Relatórios e impressão
7. Limpeza final dos patches

Após concluir Engenharia e validar com dados reais, repetir a mesma estratégia no RH.
