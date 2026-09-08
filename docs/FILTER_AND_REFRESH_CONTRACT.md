# Contrato de filtros e atualização — Gestão 3.0

Este contrato é obrigatório para todas as telas, modais, cards, gráficos, relatórios e operações do Gestão 3.0.

## 1. Filtro global de empresa

O seletor de empresa do topo define o escopo padrão da página.

- `Todas as empresas` = nenhuma empresa pode ser omitida sem um filtro local explícito.
- Empresa específica = dados empresariais da página ficam restritos à empresa escolhida.
- Um componente não pode silenciosamente escolher uma empresa-base quando o escopo global é `Todas as empresas`.

## 2. Filtro local tem precedência apenas no seu contexto

Um formulário ou página pode ter um filtro local mais específico. Quando houver seleção local explícita, ela prevalece apenas para os recursos que pertencem àquele escopo.

Exemplo de Novo lançamento:

- topo = `Todas as empresas`;
- empresa do lançamento = `CR`;
- contas bancárias e cartões = somente recursos da CR;
- categorias = continuam globais;
- dados cujo domínio for global não podem ser reduzidos pela empresa do lançamento.

## 3. Recursos globais x recursos por empresa

### Globais do tenant

- Categorias financeiras.

Categorias devem estar disponíveis em qualquer lançamento, independentemente da empresa selecionada.

### Por empresa

- Contas bancárias;
- cartões;
- saldos;
- lançamentos e movimentos da empresa;
- recursos que tenham propriedade empresarial explícita.

Quando a operação selecionar uma empresa específica, esses recursos devem ser filtrados rigorosamente por ela.

## 4. Transferências

- Em `Todas as empresas`, origem e destino podem ser contas de quaisquer empresas autorizadas do tenant.
- Em empresa específica, a visualização da página respeita essa empresa.
- Uma operação explicitamente multiempresa, como transferência entre contas, pode usar origem e destino de empresas diferentes quando iniciada no escopo `Todas as empresas`.

## 5. Atualização após mutação

Não usar polling contínuo para manter a interface atualizada.

Após qualquer mutação confirmada — criar, editar, excluir, pagar, receber, transferir, fechar/reabrir, liquidar ou alterar status — o sistema deve invalidar somente os domínios afetados e recarregar imediatamente as visões dependentes.

Evento base atual: `finance-data-changed` para mutações financeiras. O mesmo princípio deve ser aplicado aos demais módulos com eventos/domínios equivalentes.

## 6. Regra de consistência

Se o usuário vê `Todas as empresas`, a interface deve entregar todas as empresas naquele domínio. Se vê uma empresa específica, deve entregar somente aquela empresa. Exceções só podem existir quando o próprio domínio é global ou quando há um filtro local explícito e visível.

Esta regra não pode ser reimplementada de forma diferente em cada tela; componentes novos e reconstruídos devem seguir este contrato.