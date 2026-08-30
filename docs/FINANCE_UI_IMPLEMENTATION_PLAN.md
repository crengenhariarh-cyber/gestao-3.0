# Financeiro — implementação operacional da interface

## Objetivo

Levar para a interface os fluxos financeiros que já existem no domínio, repositories e Supabase, usando exclusivamente o Design System aprovado do Gestão 3.0.

## Escopo do pacote

1. Lançamentos
   - nova receita/despesa
   - identificação de parcela em toda listagem
   - baixa total ou parcial
   - atualização da visão após operação

2. Contas e bancos
   - cadastro de conta
   - saldos
   - transferência entre contas

3. Cartões
   - compra à vista/parcelada
   - faturas
   - fechamento de fatura
   - pagamento total/parcial da fatura
   - limite comprometido e disponível

4. Recorrências
   - cadastro
   - materialização da próxima ocorrência

5. Cadastros auxiliares
   - categorias
   - centros de custo

## Regra visual

- Button, Card, Dialog, Input, Select, Tabs e Feedback do Design System são obrigatórios.
- Modais permanecem fullscreen em desktop e mobile.
- Voltar e Fechar ficam disponíveis no header; Salvar/Confirmar fica no footer quando aplicável.
- Estados loading, error, empty e success devem existir nos fluxos operacionais.
- Nenhuma operação pode reutilizar dados de outra empresa; todo acesso usa tenantId + companyId ativos.

## Estratégia

Implementar em blocos dentro de uma única frente Financeiro, validando Typecheck, Lint, Test e Build antes de mergear no main.
