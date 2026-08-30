# Gestão 3.0 — Design System definitivo

Este documento congela os padrões visuais obrigatórios do Gestão 3.0. Financeiro, RH, Engenharia e demais módulos devem reutilizar os componentes compartilhados em `src/shared/ui` e não criar variantes locais concorrentes.

## Botões
Componente oficial: `Button`.
Variantes: `primary`, `secondary`, `danger`, `ghost`. Tamanhos: `sm`, `md`, `lg`. Estados: padrão, hover, foco visível, loading e desabilitado.

## Cards
Componente oficial: `Card`.
Superfície branca, borda neutra, raio e espaçamento consistentes, cabeçalho opcional e área de conteúdo padronizada.

## Modais
Componente oficial: `Dialog`.
Todo modal é fullscreen em celular, tablet e computador. Cabeçalho fixo com `Voltar`, título e `Fechar (X)`; somente o conteúdo central rola; `Salvar`, quando necessário, fica fixo no rodapé. Os controles permanecem acessíveis em qualquer posição da rolagem.

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

## Regra de governança
Botões, Cards, Modais e Tabs são componentes compartilhados obrigatórios. Alterações futuras devem ocorrer no Design System, nunca por cópias ou variantes locais específicas de Financeiro, RH, Engenharia ou outro módulo.
