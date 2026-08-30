# Gestão 3.0 — Design System definitivo

Este documento congela os padrões visuais obrigatórios do Gestão 3.0. Financeiro, RH, Engenharia e demais módulos devem reutilizar os componentes compartilhados em `src/shared/ui` e não criar variantes locais concorrentes.

## Botões

Componente oficial: `Button`.

Variantes permitidas: `primary`, `secondary`, `danger` e `ghost`.
Tamanhos permitidos: `sm`, `md` e `lg`.
Estados obrigatórios: padrão, hover, foco visível, loading e desabilitado.
A ação principal da tela ou fluxo usa `primary`; ações alternativas usam `secondary`; exclusão/ação destrutiva usa `danger`; ações de baixa ênfase usam `ghost`.

## Cards

Componente oficial: `Card`.

O card possui superfície branca, borda neutra, raio consistente, cabeçalho opcional com título/descrição/ações e área de conteúdo padronizada. Cards não devem inventar raio, espaçamento, borda ou hierarquia visual por módulo.

## Modais

Componente oficial: `Dialog`.

Regra definitiva: todo modal é fullscreen em celular, tablet e computador, ocupando toda a área disponível da aplicação.

Estrutura obrigatória:
- cabeçalho fixo com botão `Voltar`, título/descrição e botão `Fechar (X)`;
- conteúdo central é a única região principal com rolagem;
- botão `Salvar` aparece quando existir ação de confirmação e permanece fixo no rodapé;
- `Voltar`, `Fechar` e `Salvar`, quando aplicável, permanecem acessíveis independentemente da posição da rolagem;
- `Voltar` pode executar uma navegação interna fornecida por `onBack`; quando não houver etapa anterior, fecha o modal;
- o fechamento não depende de clicar fora do modal;
- o mesmo comportamento vale para cadastro, edição, visualização e demais fluxos apresentados como modal.

## Regra de governança

Alterações futuras de botão, card ou modal devem ser feitas no componente compartilhado do Design System. Não criar cópia específica para Financeiro, RH, Engenharia ou outra área.

Abas/Tabs serão definidas como componente separado e não alteram os estados padrão dos botões.
