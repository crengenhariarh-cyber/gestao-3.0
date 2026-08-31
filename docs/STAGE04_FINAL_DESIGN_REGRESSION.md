# Etapa 04/04 — Acabamento final, Design System e regressão geral

Pacote final antes do deploy único do Gestão 3.0.

## Padrões consolidados

- componentes compartilhados para botões, cards, inputs, selects, abas e modais;
- `Button` usa `type="button"` por padrão para evitar submit acidental;
- `Dialog` mantém padrão fullscreen, cabeçalho/rodapé fixos, Voltar, Fechar e Salvar quando aplicável;
- semântica ARIA reforçada nos modais;
- rota interna do UI Lab removida da aplicação final;
- barreira global de erro para impedir tela branca sem recuperação;
- safe areas para dispositivos móveis e respeito a `prefers-reduced-motion`;
- regressão automática para evitar controles HTML crus nos fluxos operacionais;
- fallback SPA em `public/_redirects` para hospedagens compatíveis com Netlify/Cloudflare Pages.

## Primeiro acesso

- o ambiente vazio possui um fluxo explícito de primeiro acesso;
- o cadastro inicial exige código de bootstrap de uso único;
- o código é validado por hash em função privada do banco e não é persistido no usuário;
- o primeiro cadastro cria tenant, empresa inicial, vínculo `tenant_owner` e vínculo `company_admin`;
- uma segunda tentativa de bootstrap é bloqueada pelo banco;
- usuários autenticados sem empresa autorizada não entram nos módulos.

## Critérios de homologação

1. Typecheck verde;
2. Lint verde;
3. Test verde, incluindo `DesignSystemRegression.test.ts`;
4. Build verde;
5. regressão estrutural final do Supabase sem RLS faltando, sem grants anônimos críticos e sem funções públicas `SECURITY DEFINER`;
6. branch final comparada diretamente com `main`;
7. nenhum deploy antes da aprovação final.
