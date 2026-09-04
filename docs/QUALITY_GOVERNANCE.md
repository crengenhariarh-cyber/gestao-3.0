# Governança de qualidade — Gestão 3.0

## Regra não negociável

O Gestão 3.0 não pode evoluir por acúmulo de remendos. Correções locais são permitidas apenas quando preservam ou melhoram a arquitetura. Se a dívida técnica ultrapassar os limites definidos abaixo, novas atualizações funcionais devem ser bloqueadas até a causa estrutural ser corrigida.

## Estados

- **GREEN**: arquitetura aderente; atualizações normais permitidas.
- **AMBER**: existe dívida técnica conhecida; atualizações só podem entrar se não aumentarem a dívida e se incluírem testes/validação adequados.
- **RED / FREEZE**: excesso de remendos ou quebra de regra estrutural; novas funcionalidades e ajustes cosméticos ficam bloqueados. Só são aceitas correções de segurança, disponibilidade, perda de dados ou refatorações que reduzam a dívida.

## Gatilhos automáticos de bloqueio

O CI deve falhar quando ocorrer qualquer um destes eventos:

1. criação de workflow `hotfix-*` que altere código automaticamente;
2. criação de nova folha CSS global de `patch`, `hotfix`, `override` ou `polish` fora da exceção legada já inventariada;
3. aumento do número de componentes de `ui/` que acessam o cliente Supabase diretamente;
4. criação/crescimento de página de UI acima do limite de 45 KB sem decomposição;
5. falha de typecheck, lint, testes ou build;
6. introdução de nova exceção arquitetural sem registro neste documento.

## Baseline de dívida em 04/09/2026

Estado: **AMBER**.

Dívidas conhecidas que devem diminuir, nunca aumentar:

- há **7 arquivos em camadas `ui/`** acessando Supabase diretamente, apesar de `docs/ARCHITECTURE.md` proibir UI → Supabase;
- existe a camada global legada `public/module-polish.css`, permitida apenas como baseline temporária e proibida de se multiplicar;
- existem páginas grandes, especialmente Financeiro e RH, que devem ser gradualmente decompostas;
- o banco ainda possui alertas de segurança e performance pendentes no Supabase Advisor;
- a cobertura de testes é boa em validações financeiras e Design System, mas ainda insuficiente em fluxos completos de RH, Engenharia e Orçamento.

## Política de correção

- Não criar um segundo caminho para a mesma regra de negócio.
- Não corrigir comportamento com comparação por nome, texto exibido, posição visual ou seletor CSS frágil quando existe identificador estrutural.
- Não duplicar regra de cálculo entre UI e banco sem contrato/teste de equivalência.
- Não colocar acesso direto ao banco em novos componentes de UI.
- Mudança de schema deve ser feita por migration versionada.
- Toda correção em área crítica deve preferir refatoração do ponto de origem ao invés de sobreposição posterior.

## Saída do estado AMBER

Para retornar a GREEN:

1. mover os acessos diretos a Supabase da UI para `application/infrastructure`;
2. remover `module-polish.css` incorporando os estilos ao Design System/módulos corretos;
3. reduzir páginas monolíticas de maior risco;
4. eliminar alertas de segurança críticos do Supabase;
5. adicionar testes de integração/regressão para Orçamento, RH e Engenharia.

Enquanto esses itens não forem concluídos, a regra é: **não aumentar a dívida técnica**.
