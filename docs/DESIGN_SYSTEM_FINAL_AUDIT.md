# Auditoria final de Design System — Gestão

## Regra global

- Desktop/navegador: tema claro como padrão operacional.
- Aplicativo/PWA em telas móveis: tema escuro como padrão visual.
- Componentes de negócio não definem cores próprias para Button, Card, Dialog, Tabs, campos, feedbacks ou estados.
- Alterações visuais globais devem ocorrer nos componentes/tokens compartilhados e refletir em todos os módulos.

## Componentes canônicos

- `src/shared/ui/Button.tsx`
- `src/shared/ui/Card.tsx`
- `src/shared/ui/Dialog.tsx`
- `src/shared/ui/Tabs.tsx`
- campos e feedbacks em `src/shared/ui`
- tokens e estilos canônicos em `src/shared/ui/styles.css`

## Modal

Todo Dialog é fullscreen, com cabeçalho e rodapé fixos, conteúdo rolável, Voltar, Fechar e Salvar quando aplicável. Mantém foco, Escape, aria-modal e bloqueio de rolagem do body.

## Botões

Somente variantes do Design System: primary, secondary, tertiary, success e danger. Tamanhos sm/md/lg. Estado loading/disabled/focus centralizado.

## Cards

Cards usam `Card` compartilhado e tokens de surface/border/radius. Cabeçalho, descrição, ações e conteúdo seguem uma única anatomia.

## Tema

Tokens são a fonte de verdade. Desktop usa tokens claros. Em viewport móvel/PWA os mesmos componentes recebem tokens escuros; não existe um segundo conjunto de componentes.

## Critérios de regressão

1. Nenhuma tela de negócio deve criar um segundo Button/Card/Dialog/Tabs.
2. Nenhum modal de negócio pode fugir do Dialog fullscreen.
3. Nenhuma alteração de cor/raio/espaçamento do padrão deve ser copiada tela a tela.
4. Desktop e mobile usam a mesma árvore de componentes; apenas tokens/layout responsivo mudam.
5. Navegação, campos, cards e estados precisam manter contraste, foco visível e alvos adequados ao toque.
