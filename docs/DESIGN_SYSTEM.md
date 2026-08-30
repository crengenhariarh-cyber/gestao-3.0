# Gestão 3.0 — Design System definitivo

Este documento congela os padrões visuais obrigatórios do Gestão 3.0. Financeiro, RH, Engenharia e demais módulos devem reutilizar os componentes compartilhados em `src/shared/ui` e não criar variantes locais concorrentes.

## Botões
Componente oficial: `Button`.

Variantes oficiais:
- `primary`: ação principal, azul `#2563EB`;
- `secondary`: ação alternativa, superfície branca com borda neutra;
- `tertiary`: ação de baixa ênfase, sem fundo permanente;
- `success`: confirmação positiva, verde `#16A34A`;
- `danger`: ação destrutiva, vermelho `#DC2626`.

Tamanhos permitidos: `sm`, `md`, `lg`.
Estados obrigatórios: padrão, hover, foco visível, loading e desabilitado.
Não criar botões visuais locais fora do componente compartilhado, exceto elementos semânticos internos do próprio Design System.

## Cards
Componente oficial: `Card`.
Superfície branca, borda neutra, raio e espaçamento consistentes, cabeçalho opcional e área de conteúdo padronizada. Cards de módulos devem reutilizar esse componente em vez de reproduzir sua aparência localmente.

## Modais
Componente oficial: `Dialog`.
Todo modal é fullscreen em celular, tablet e computador, ocupando toda a área disponível.

Estrutura obrigatória:
- `Voltar` fixo no cabeçalho;
- título/descrição no cabeçalho;
- `Fechar (X)` fixo no cabeçalho;
- somente o conteúdo central possui rolagem principal;
- `Salvar`, quando necessário, permanece fixo no rodapé;
- clicar fora não fecha o modal;
- Escape fecha quando não há operação de salvamento em andamento;
- foco permanece contido no modal enquanto aberto;
- ao fechar, o foco retorna ao elemento anterior;
- a rolagem da página de fundo fica bloqueada.

## Abas / Tabs
Componente oficial: `Tabs`.

Padrão definitivo aprovado:
- altura padrão 40px e variante compacta 32px;
- raio 8px e espaçamento de 8px;
- ativa: fundo azul `#2563EB`, texto branco;
- inativa: fundo branco, texto `#1F2937`, borda neutra;
- hover: fundo `#F1F5F9`;
- foco: contorno azul visível;
- desabilitada: fundo `#F8FAFC`, texto `#9CA3AF`, sem interação;
- ícone opcional de 16px antes do texto;
- contador opcional em badge azul-claro;
- rótulos sempre em uma linha, sem quebra;
- desktop, tablet e celular usam o mesmo componente;
- quando não houver espaço, as abas mantêm tamanho legível e usam rolagem horizontal;
- abas servem para trocar conteúdo/seção dentro da mesma tela; não abrem modal e não recarregam a aplicação inteira.

## UI Lab
`src/app/UiLab.tsx` é a referência executável dos componentes. Qualquer novo padrão global aprovado deve aparecer nele antes de ser considerado congelado.

## Regra de governança
Botões, Cards, Modais e Tabs são componentes compartilhados obrigatórios. Alterações futuras devem ocorrer no Design System, nunca por cópias ou variantes locais específicas de Financeiro, RH, Engenharia ou outro módulo.
