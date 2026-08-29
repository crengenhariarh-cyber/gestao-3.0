# Financeiro — Gestão 3.0

## Objetivo

Definir um núcleo financeiro novo, auditável e isolado por tenant e empresa, sem copiar tabelas ou regras técnicas do Gestão 2.0.

## Princípios

- `tenant_id` e `company_id` são estruturais.
- Um lançamento nunca muda de empresa depois de criado; correções relevantes geram operação auditável.
- Valores monetários são armazenados em `numeric(14,2)`.
- Status financeiro é derivado do histórico de baixas, não de um campo solto editável.
- Parcelas são registros próprios, com `installment_number` e `installment_count` explícitos.
- Recorrência e parcelamento são conceitos diferentes.
- Transferência entre contas gera duas pernas vinculadas por uma mesma operação.
- Cartão representa meio de pagamento + ciclo de fatura; compra e pagamento da fatura são eventos distintos.
- Realizado deve ser derivado de operações efetivamente baixadas/pagas.
- Nenhuma regra crítica vive em página React.

## Entidades de base

### `financial_categories`
Classificação financeira por empresa. Pode ser entrada ou saída e pode ser desativada sem apagar histórico.

### `cost_centers`
Centro de custo/obra por empresa. Será a referência estrutural usada posteriormente por orçamento, RH e engenharia.

### `financial_accounts`
Contas onde existe saldo real: banco, dinheiro ou outra conta de caixa. Cada conta pertence a uma única empresa.

### `financial_entries`
Cabeçalho do compromisso financeiro. Representa a obrigação ou direito: fornecedor/beneficiário, descrição, categoria, centro de custo, competência e natureza entrada/saída.

### `financial_installments`
Parcelas ou ocorrência única do lançamento. Cada registro possui vencimento, valor, número da parcela e total de parcelas. Lançamento à vista usa `1/1`.

### `financial_settlements`
Baixas efetivas. Permite pagamento/recebimento parcial ou total e registra conta financeira, data, valor e referência idempotente.

### `financial_transfers`
Operação de transferência entre duas contas financeiras da mesma empresa. A operação é indivisível e auditável.

### `credit_cards`
Cartões vinculados a uma empresa, com conta de pagamento padrão opcional, dia de fechamento, dia de vencimento e limite configurável.

### `card_transactions`
Compra feita no cartão. Pode originar uma ou várias parcelas de fatura, mantendo fornecedor, categoria, centro de custo e descrição.

### `card_installments`
Parcela individual de compra no cartão, com número da parcela, total de parcelas e competência da fatura.

### `card_statement_payments`
Pagamento de fatura, separado da compra. Afeta a conta financeira usada para pagar a fatura.

## Status derivados

Para uma parcela financeira:

- `pending`: soma das baixas = 0;
- `partial`: soma das baixas > 0 e < valor da parcela;
- `paid`: soma das baixas >= valor da parcela.

A UI pode exibir o status, mas não deve persistir manualmente uma versão divergente do histórico financeiro.

## Parcelamento

Todo lançamento materializado possui parcela explícita:

- à vista: `1/1`;
- 3 parcelas: `1/3`, `2/3`, `3/3`;
- compra de cartão em 10 vezes: cada parcela possui sua competência de fatura e `installment_number = 1..10`.

O número da parcela deve ficar disponível em todas as consultas e projeções para que a interface possa exibi-lo em qualquer tela relevante.

## Recorrência

Recorrência não reutiliza a mesma parcela. Uma regra recorrente gera ocorrências independentes, preservando rastreabilidade. Alteração futura pode afetar apenas a ocorrência selecionada ou as ocorrências futuras ainda não realizadas.

## Transferências

Transferências não são despesa nem receita. Devem ser excluídas de resultado operacional para evitar dupla contagem. O saldo das contas muda, mas o resultado consolidado da empresa não.

## Auditoria e idempotência

Baixas, transferências, geração de parcelas e fechamento/pagamento de fatura devem aceitar uma chave idempotente. Repetir a mesma requisição não pode duplicar efeito financeiro.

Eventos críticos devem produzir registro de auditoria com tenant, empresa, usuário, entidade, ação e metadados mínimos.

## Próximos passos

1. Criar migrations dos cadastros base.
2. Criar RLS das novas tabelas usando o contexto já validado da Fase 3.
3. Implementar repositórios e casos de uso fora da UI.
4. Criar testes matemáticos e de isolamento antes das telas finais.
