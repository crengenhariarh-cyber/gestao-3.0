# Auditoria final de Design System — Gestão

## Regra global

- Desktop/navegador e aplicativo/PWA usam a mesma identidade visual e a mesma árvore de componentes.
- A referência operacional aprovada é clara, com superfícies brancas, azul primário, estados semânticos e contraste consistente; a Home homologada é a referência visual para a atualização página a página.
- Um eventual tema escuro só pode ser introduzido por tokens compartilhados, nunca por CSS isolado de uma tela.
- Componentes de negócio não criam um segundo Button, Card, Dialog, Tabs, campos, feedbacks ou estados.
- Alterações visuais globais devem ocorrer nos componentes/tokens compartilhados e refletir nos módulos conforme a homologação de cada página.

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

Somente variantes do Design System: primary, secondary, tertiary, success e danger. Tamanhos sm/md/lg. Estado loading/disabled/focus centralizado. Elementos clicáveis de negócio devem reutilizar `Button`, mesmo quando recebam composição visual específica de dashboard.

## Cards

Cards usam `Card` compartilhado e tokens de surface/border/radius. Cabeçalho, descrição, ações e conteúdo seguem uma única anatomia.

## Tema

Tokens são a fonte de verdade. Desktop e mobile usam os mesmos componentes; apenas composição responsiva, safe areas e dimensões adaptativas mudam. A aparência aprovada não deve ser recriada por componentes paralelos.

## Critérios de regressão

1. Nenhuma tela de negócio deve criar um segundo Button/Card/Dialog/Tabs.
2. Nenhum modal de negócio pode fugir do Dialog fullscreen.
3. Nenhuma alteração global de cor/raio/espaçamento deve ser copiada tela a tela.
4. Desktop e mobile usam a mesma árvore de componentes; apenas tokens/layout responsivo mudam.
5. Navegação, campos, cards e estados precisam manter contraste, foco visível e alvos adequados ao toque.
6. A Home participa obrigatoriamente da regressão automática de controles compartilhados.
