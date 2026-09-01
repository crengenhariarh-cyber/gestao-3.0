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

## Regra obrigatória de compartilhamento

- Cor, raio, altura, espaçamento, tipografia, foco, loading, disabled, hover e anatomia dos controles são definidos apenas no Design System compartilhado.
- Nenhuma página de negócio pode sobrescrever cor de `Button`, `Tabs`, `Input`, `Dialog` ou `Card` para criar uma versão própria do mesmo componente.
- Classes de módulo podem controlar somente composição e contexto: grid, largura, ordem, espaçamento entre blocos, destaque semântico e responsividade.
- Uma alteração global solicitada para um componente deve ser feita uma única vez no componente/tokens compartilhados e deve refletir automaticamente em todas as telas que usam esse componente.
- Exemplo obrigatório: ao alterar a cor do botão primário, a mudança deve ser feita no token/componente canônico e todos os botões primários do sistema devem mudar juntos; é proibida alteração botão a botão ou tela a tela.
- Exceções visuais só podem existir quando representarem uma variante semântica oficial do Design System, nunca uma cópia local do componente.

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
7. Nenhuma página de negócio pode sobrescrever as cores das variantes canônicas de Button/Tabs/Input/Dialog/Card.
8. Mudanças globais de componente devem exigir uma única alteração no Design System e produzir efeito em todas as telas consumidoras.
