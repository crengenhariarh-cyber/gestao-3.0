# Design System — Engenharia

## Objetivo
A reconstrução da Engenharia deve preservar a usabilidade madura do Gestão 2.0 sem criar uma linguagem visual paralela. O Gestão 3.0 já possui Design System compartilhado em `src/shared/ui` e tokens canônicos em `src/shared/ui/styles.css`.

## Fonte de verdade visual
- Componentes: `Button`, `Card`, `Dialog`, `Input`, `MoneyInput`, `Select`, `SearchableSelect`, `Badge`, `Feedback`, `PageHeader` e demais primitivas em `src/shared/ui`.
- Tokens: `--space-*`, `--radius-*`, `--border`, `--surface*`, `--text`, `--muted`, `--primary*`, `--success*`, `--danger*`, `--warning*`, `--info*`, `--focus-ring`, `--shadow-*`.
- Modal padrão: `Dialog` canônico, tela cheia e com cabeçalho/rodapé fixos quando aplicável.

## Regras obrigatórias para Engenharia
1. Não criar variante visual própria de botão, card, dialog, input, select, badge ou feedback quando houver primitiva compartilhada.
2. Não redefinir `.ui-button-*`, `.ui-card`, `.ui-dialog`, `.ui-input` ou `.ui-tab` dentro do módulo.
3. Não usar cores hex/rgba próprias para estados comuns quando existir token equivalente.
4. Não usar posição da DOM (`nth-child`, `last-child`) para determinar significado visual ou comportamento.
5. CSS do módulo pode compor layout, densidade e hierarquia, mas não substituir a identidade das primitivas canônicas.
6. Todo fluxo deve ser responsivo e operável no celular sem esconder ação crítica.
7. Novas correções devem entrar no código definitivo; CI não pode reescrever a aplicação por scripts de patch antes de testar/publicar.

## Referência funcional x visual
- Gestão 2.0: referência de fluxo, simplicidade, ordem das informações e quantidade de etapas.
- Gestão 3.0: referência técnica, Design System, responsividade, acessibilidade e arquitetura.

## Critério de aceite de uma tela
Uma tela da Engenharia só é considerada consolidada quando:
- mantém ou melhora a funcionalidade equivalente do 2.0;
- usa as primitivas/tokens do Design System;
- não depende de workflow/script de correção para funcionar;
- passa Architecture Guard, Typecheck, Lint, Test e Build sem mutação prévia do código;
- funciona em desktop e mobile com a mesma lógica de negócio.

## Débito identificado
A Medição ainda possui CSS legado com várias cores e composições específicas em `guided-measurement-flow.css`. A reconstrução visual deve migrar gradualmente essas regras para tokens e componentes compartilhados sem alterar persistência, saldos ou histórico já funcional.
