# Gestão 3.0 — Modelo oficial de RH + Orçamento

## Princípios estruturais

1. Todo dado de RH pertence a um `tenant_id` e a uma `company_id`.
2. A alocação operacional/orçamentária usa `cost_center_id` quando aplicável. Empresa e centro de custo nunca são inferidos pelo nome do colaborador.
3. O colaborador possui identidade própria; vínculo empregatício, remuneração e alocação possuem histórico temporal separado.
4. Fechamento mensal é um snapshot auditável. Depois de fechado, correções relevantes devem ocorrer por reabertura/ajuste controlado, nunca por alteração silenciosa do histórico.
5. Valores trabalhistas e orçamentários críticos são calculados no PostgreSQL com `numeric`, e não por soma financeira na UI.
6. RH calcula eventos e obrigações. Financeiro recebe obrigações consolidadas por integração explícita; não duplica a folha.
7. Previsto e Realizado são conceitos diferentes e rastreáveis.
8. Nenhuma regra crítica fica dentro de componente React.

## Entidades

### `employees`
Identidade cadastral do colaborador dentro do tenant.

Campos conceituais principais:
- `id`
- `tenant_id`
- nome e dados cadastrais necessários
- status cadastral
- timestamps

A identidade do colaborador não define empresa, obra nem salário atual.

### `employment_contracts`
Vínculo temporal do colaborador com uma empresa.

Campos conceituais:
- `id`
- `tenant_id`
- `company_id`
- `employee_id`
- data de admissão
- data de desligamento opcional
- função/cargo
- tipo/status do vínculo

Um fechamento sempre aponta para um vínculo específico.

### `employee_allocations`
Histórico temporal de alocação do vínculo em obra/centro de custo.

Campos:
- `employment_contract_id`
- `cost_center_id`
- início/fim de vigência
- percentual de alocação quando necessário

A empresa do centro de custo deve coincidir estruturalmente com a empresa do vínculo.

### `compensation_terms`
Histórico de remuneração contratual.

Campos:
- `employment_contract_id`
- vigência inicial/final
- salário-base
- demais valores contratuais recorrentes quando aplicável

Nunca sobrescrever salário histórico para recalcular competências antigas.

### `payroll_events`
Eventos variáveis ou ajustes da competência.

Exemplos:
- falta
- DSR
- hora extra
- adiantamento
- benefício/desconto
- ajuste positivo/negativo

Cada evento possui tipo, competência, quantidade/base quando aplicável, valor e origem. Eventos devem ser rastreáveis e não misturar empresas.

### `payroll_closings`
Cabeçalho do fechamento mensal por vínculo e competência.

Identidade lógica única:
`tenant_id + company_id + employment_contract_id + competence_month`

Contém snapshot das bases e totais necessários para auditoria.

### `payroll_closing_lines`
Linhas calculadas do fechamento.

Exemplos:
- salário-base
- faltas
- DSR
- adiantamento
- INSS
- IRRF
- FGTS
- líquido
- outros eventos

Cada linha informa natureza, incidências e valor calculado.

### `payroll_obligations`
Obrigações resultantes do fechamento para integração financeira.

Exemplos:
- pagamento líquido ao colaborador
- adiantamento quando tratado como obrigação separada
- FGTS consolidável
- outras obrigações patronais previstas no escopo

A obrigação possui identidade idempotente e referência ao fechamento/origem.

### `budget_projections`
Projeções futuras por empresa, centro de custo, competência e natureza.

Fontes possíveis:
- salário contratual vigente
- encargos projetados
- limites/custos planejados
- outras projeções aprovadas futuramente

Projeção não é lançamento realizado.

## Competência e histórico

- Competência mensal é representada pelo primeiro dia do mês (`YYYY-MM-01`).
- Salário previsto de cada competência deriva do termo de remuneração vigente naquela competência.
- Mudança salarial futura altera apenas competências cobertas pela nova vigência.
- Alteração de obra/centro de custo respeita a vigência da alocação.
- Fechamentos históricos não são recalculados automaticamente por mudanças cadastrais posteriores.

## Fechamento mensal

Fluxo conceitual:

1. identificar vínculo ativo na competência;
2. resolver salário/remuneração vigente;
3. resolver alocação/centro de custo vigente;
4. capturar eventos da competência;
5. calcular proventos e descontos;
6. calcular incidências e encargos;
7. gerar linhas do fechamento;
8. gerar snapshot do fechamento;
9. gerar obrigações financeiras idempotentes;
10. registrar auditoria.

O fechamento deve ser atômico: ou todas as etapas críticas são confirmadas, ou nenhuma é.

## Faltas, DSR e incidências

Faltas e DSR são eventos distintos e precisam permanecer identificáveis no fechamento. A incidência sobre INSS, IRRF e FGTS não será inferida na UI; será definida por regras de cálculo versionadas/testadas.

As tabelas legais e fórmulas sujeitas a mudança temporal devem possuir vigência, permitindo reproduzir matematicamente um fechamento histórico.

## INSS, IRRF e FGTS

- INSS e IRRF são calculados a partir das bases do fechamento e da tabela/regra vigente na competência.
- FGTS é calculado por colaborador para auditoria, mas sua obrigação financeira pode ser consolidada por `tenant + company + competence`, evitando uma conta a pagar separada por colaborador.
- O detalhe individual nunca é perdido pela consolidação financeira.

## Integração com Financeiro

RH não escreve diretamente em tabelas financeiras pela UI.

Uma operação de integração controlada transforma `payroll_obligations` em lançamentos/parcelas financeiros, preservando:
- `tenant_id`
- `company_id`
- `cost_center_id` quando aplicável
- competência
- origem RH
- chave idempotente
- referência ao fechamento/obrigação

Reexecutar a integração não pode duplicar Contas a Pagar.

## Previsto × Realizado

### Previsto
Nasce de contratos/remunerações e demais regras de projeção vigentes para competências futuras. Portanto, um salário cadastrado pode alimentar automaticamente os meses futuros previstos sem exigir fechamento antecipado.

### Realizado
Nasce do evento efetivamente reconhecido conforme a regra do módulo:
- folha: fechamento mensal aprovado gera o realizado orçamentário da competência;
- caixa: baixa financeira permanece um conceito financeiro separado.

Assim, orçamento operacional e fluxo de caixa não são confundidos.

## Isolamento

A ordem estrutural é:
`tenant -> company -> cost center/work -> employment contract -> employee/competence`.

Nenhuma consulta ou operação crítica pode depender apenas de `employee_id`.

## Idempotência e auditoria

Devem aceitar chave idempotente ou identidade natural protegida:
- fechamento mensal;
- reabertura/ajuste controlado;
- geração de obrigações;
- integração com Contas a Pagar;
- materialização de projeções.

Eventos críticos entram no `audit_log` com ator, empresa, entidade, competência e metadados relevantes.

## Ordem de implementação da Fase 5

1. cadastro e vínculo temporal;
2. remuneração e alocação;
3. eventos da folha;
4. motor de fechamento;
5. faltas/DSR e incidências;
6. tabelas/regras legais vigentes;
7. obrigações e integração financeira;
8. projeção Previsto × Realizado;
9. orçamento mensal/anual;
10. regressões matemáticas, RLS e shell.

Nenhuma publicação/deploy faz parte desta definição.