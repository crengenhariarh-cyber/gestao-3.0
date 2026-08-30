# Engenharia — Modelo oficial do domínio

## Status
Fase 06 | Etapas 06.01 a 06.04 — concluídas | Próxima: 06.05

Este documento congela as fronteiras conceituais do módulo Engenharia antes da criação do schema. O Gestão 2.0 é apenas referência de regras de negócio; nenhum código, tabela, função, trigger ou policy legada é copiado.

## 1. Raiz estrutural
Toda entidade operacional da Engenharia pertence obrigatoriamente a `tenant_id` e `company_id`. A hierarquia principal é:

`tenant -> company -> work -> contract -> structure/service -> measurement/production`

O acesso a uma entidade filha nunca pode ampliar o acesso concedido à empresa pai.

## 2. Obra e estrutura física
- `works`: obra/empreendimento da empresa.
- `work_structures`: estrutura hierárquica flexível da obra, permitindo torre/bloco, pavimento e unidade sem criar schemas diferentes para prédio, condomínio horizontal ou galpão.
- Cada nó possui `parent_id`, `structure_type`, código/nome e ordenação.
- Exemplos válidos: Torre 4 -> Pavimento 01 -> Unidade 101; Casas -> Unidade 17; Galpão -> Setor A.
- A estrutura física é independente do contrato para poder ser reutilizada por contrato/aditivo sem duplicação.

## 3. Contratos
- `engineering_contracts`: cabeçalho contratual por obra e empresa.
- Possui número, cliente, datas, status, valor-base e metadados comerciais essenciais.
- Um contrato possui itens/serviços em `contract_services`.
- Cada serviço registra descrição, unidade de medida, quantidade contratada, valor unitário e valor contratado calculável com precisão decimal.
- O valor-base do contrato é derivado automaticamente da soma dos serviços ativos.
- O saldo contratado será derivado do contratado menos medições válidas; não é um campo livre editável.
- Alterações que mudem histórico financeiro depois de medição exigem fluxo explícito, nunca sobrescrita silenciosa.

## 4. Medições
- `measurements`: cabeçalho por contrato e competência mensal.
- `measurement_lines`: serviço + estrutura física + quantidade medida + preço contratual snapshot + valor bruto.
- Uma linha pode apontar até o nível necessário: torre/bloco, pavimento ou unidade.
- A soma medida não pode ultrapassar o saldo contratual sem aditivo/serviço autorizado.
- Medições possuem estados de trabalho, fechada/aprovada e eventualmente cancelada/reaberta conforme fluxo auditado.
- Fechamento cria snapshot histórico; alterações posteriores exigem reabertura explícita.

## 5. Retenções e pagamento
- Retenções são linhas próprias vinculadas à medição, não descontos destrutivos no valor bruto.
- Deve suportar INSS, ISS, retenção técnica (RT) e outras retenções configuráveis.
- Relatórios distinguem valor bruto, retenções e valor líquido.
- A evolução de pagamento é distinta da evolução física/medida.

## 6. Aditivos
- `contract_addenda`: aditivo vinculado a contrato existente.
- `contract_addendum_lines`: linhas de alteração de quantidade/valor, podendo apontar para serviço já contratado ou representar inclusão.
- Pode alterar/adicionar serviços, quantidades e valores de forma rastreável.
- O contrato original não é reescrito para apagar o histórico anterior.
- Totais consolidados consideram contrato-base + aditivos efetivos.

## 7. Provisórios
- `provisional_contracts` e `provisional_contract_lines` representam negociação ainda não efetivada.
- Enquanto provisório, serviço, quantidade e valor unitário podem ser editados.
- Conversão é operação controlada e atômica para novo contrato ou aditivo de contrato existente.
- Apenas provisório aprovado pode ser convertido.
- A conversão preserva origem e cria vínculo entre provisório e destino.
- Um provisório convertido não pode ser convertido novamente.

## 8. Produção por colaborador
- Produção é independente da medição do cliente, embora possa referenciar o mesmo serviço/estrutura.
- `production_entries`: lançamento operacional por obra, serviço, estrutura, competência/data e quantidade produzida.
- `production_allocations`: rateio do lançamento entre um ou mais colaboradores.
- O rateio deve fechar 100% ou a quantidade/valor integral conforme a regra adotada no lançamento.
- Colaborador precisa possuir vínculo/autorização compatível com empresa/obra no período.
- Fechamento mensal de produção gera snapshot e bloqueia edição direta.

## 9. Fechamento, bloqueio e reabertura
- Medições e produção fechadas não são editadas diretamente.
- Reabertura exige permissão, motivo, ator, timestamp e registro de auditoria.
- Itens já vinculados a pagamento/fechamento financeiro recebem proteção adicional contra alteração silenciosa.
- Exclusão física de histórico financeiro/operacional fechado não é fluxo normal; usar cancelamento/reversão auditada.

## 10. Indicadores oficiais
Por contrato/obra, o domínio deriva valor contratado base, aditivos efetivos, contratado final, medido bruto, retenções, líquido medido, saldo a medir, percentual medido, evolução física/produção e evolução de pagamento quando integrado ao Financeiro. Percentuais são derivados dos valores oficiais e não digitados manualmente.

## 11. Integrações
- Financeiro recebe somente eventos financeiros validados, com chave de origem/idempotência para impedir duplicação.
- RH fornece colaboradores e vínculos autorizados; Engenharia não duplica cadastro de colaborador.
- Orçamento recebe realizado/comprometido segundo regra explícita, sem confundir medição do cliente, produção interna e fluxo de caixa.
- Nenhum módulo acessa tabela de outro domínio diretamente pela UI; integrações passam por contratos/repositories/RPCs definidos.

## 12. Segurança
- RLS desde a criação das tabelas.
- FKs compostas preservam `tenant_id + company_id` nas relações críticas.
- Escritas críticas usam operações controladas, auditáveis e idempotentes.
- Valores monetários usam `numeric`, nunca ponto flutuante.
- Funções privilegiadas usam `search_path` fixo e autorização explícita.

## 13. UI e Design System
- A Engenharia reutiliza exclusivamente os componentes compartilhados do Design System.
- Abas trocam conteúdo na mesma tela.
- Modais são fullscreen em celular e computador, com Voltar e Fechar sempre disponíveis e Salvar fixo quando aplicável.
- Nenhum componente visual concorrente é criado dentro do módulo.

## 14. Implementação concluída até 06.04
- 06.01: modelo conceitual congelado.
- 06.02/06.03: `works` e `work_structures` implantadas com RLS e hierarquia física flexível.
- 06.04: contratos, serviços contratuais, provisórios, linhas provisórias, aditivos e linhas de aditivo implantados.
- `convert_provisional_contract(...)` executa conversão atômica de provisório aprovado para contrato ou aditivo.
- `sync_engineering_contract_base_value()` mantém o valor-base do contrato derivado dos serviços ativos.

## Decisões congeladas
1. Obra é entidade própria e pertence a tenant + empresa.
2. Estrutura física é hierárquica e flexível.
3. Contrato-base, aditivo e provisório possuem papéis distintos e histórico preservado.
4. Medição do cliente e produção de colaborador são processos diferentes.
5. Saldos, totais e percentuais são derivados, não campos livres.
6. Fechamentos geram bloqueio e exigem reabertura auditada.
7. Provisório convertido mantém rastreabilidade e não pode ser convertido duas vezes.
8. Integrações com Financeiro/RH/Orçamento não podem gerar dupla contagem.
9. Isolamento tenant -> company -> work/contract é obrigatório em banco e aplicação.
10. Nenhuma publicação é necessária para desenvolver ou validar esta fase.
