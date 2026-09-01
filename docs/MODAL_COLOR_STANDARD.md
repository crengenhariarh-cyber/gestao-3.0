# Padrão global de cores dos modais

Todos os modais do Gestão 3.0 usam o mesmo `Dialog` compartilhado e seguem o tema claro homologado da Home.

- Fundo do modal: superfície clara do Design System.
- Cabeçalho e rodapé: branco/surface, separados por borda suave.
- Conteúdo: fundo claro sutil.
- Campos e seletores: fundo branco, texto escuro, borda neutra e foco azul.
- Botões: variantes oficiais do Design System.
- Seletores nativos devem usar `color-scheme: light`, inclusive no mobile/PWA.
- Não criar sobrescritas de cor específicas por página/modal.

O padrão é aplicado em `src/shared/ui/styles.css` e herdado por todos os componentes `Dialog`.
