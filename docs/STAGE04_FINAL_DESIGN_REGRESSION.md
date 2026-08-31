# Etapa 04/04 — Acabamento final, Design System e regressão geral

Pacote final antes do deploy único.

Escopo executado:
- Button compartilhado com `type="button"` por padrão para evitar submits acidentais;
- Dialog fullscreen preservado com foco, Escape, Voltar, Fechar, Salvar e semântica ARIA completa;
- safe areas de mobile aplicadas ao modal;
- preferência de redução de movimento respeitada;
- link de salto para o conteúdo principal;
- rota interna `/ui-lab` removida da aplicação final;
- barreira global de erro para evitar tela branca em falha inesperada de renderização;
- regressão automatizada do Design System para impedir controles HTML crus nos fluxos operacionais de Financeiro, RH e Engenharia;
- manutenção dos módulos no mesmo contexto empresarial selecionado.

Critérios de homologação:
1. Typecheck verde;
2. Lint verde;
3. Test verde, incluindo `DesignSystemRegression.test.ts`;
4. Build verde;
5. regressão estrutural final do Supabase sem RLS faltando, sem grants anônimos críticos e sem funções públicas SECURITY DEFINER;
6. nenhum deploy antes da aprovação final.
