# Governança de qualidade — Gestão 3.0

## Regra não negociável

O Gestão 3.0 não pode evoluir por acúmulo de remendos. Correções locais são permitidas apenas quando preservam ou melhoram a arquitetura. Se a dívida técnica ultrapassar os limites definidos abaixo, novas atualizações funcionais devem ser bloqueadas até a causa estrutural ser corrigida.

## Meta obrigatória do refinamento total

O refinamento do Gestão 3.0 será feito módulo/tela por módulo/tela, mas cada área trabalhada deve sair daquele ciclo **com qualidade mínima 9,0/10 tanto visual quanto estruturalmente**. Não é suficiente deixar a tela bonita mantendo dívida técnica escondida no código.

Ao refinar uma tela, o mesmo ciclo deve obrigatoriamente:

1. concluir o acabamento visual em desktop, tablet e celular;
2. remover remendos, overrides e exceções existentes naquela área sempre que tecnicamente possível;
3. eliminar ou reduzir acesso direto UI → Supabase, levando persistência e regras para as camadas corretas;
4. decompor componentes/páginas excessivamente grandes quando a manutenção estiver comprometida;
5. consolidar estilos no Design System ou no módulo correto, sem criar nova camada global de correção;
6. preservar isolamento por tenant, empresa e centro de custo/obra;
7. revisar regras de negócio e impedir duplicidade de cálculo entre tela e banco;
8. validar estados de carregamento, vazio, erro, confirmação, sucesso e responsividade;
9. adicionar ou atualizar testes de regressão da área crítica modificada;
10. passar Architecture Guard, typecheck, lint, testes e build antes de considerar o refinamento concluído.

**Critério de saída:** uma tela/módulo refinado não deve ser marcado como concluído se a auditoria daquele ponto resultar abaixo de **9,0/10**. Se não for possível atingir 9,0 sem refatoração estrutural adicional, a refatoração passa a fazer parte do próprio refinamento e deve ocorrer antes de avançar.

A meta final do produto após a consolidação completa é **mínimo 9,0/10**, com alvo de **9,5/10**.

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
6. introdução de nova exceção arquitetural sem registro neste documento;
7. conclusão declarada de tela refinada mantendo remendo novo ou aumentando a dívida técnica da área.

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
- Tela refinada deve ter acabamento profissional e código igualmente refinado; qualidade visual não compensa arquitetura ruim e arquitetura boa não compensa tela crua.
- Ao tocar em dívida técnica pertencente à tela que está sendo refinada, a direção obrigatória é reduzi-la, nunca apenas escondê-la.

## Saída do estado AMBER

Para retornar a GREEN:

1. mover os acessos diretos a Supabase da UI para `application/infrastructure`;
2. remover `module-polish.css` incorporando os estilos ao Design System/módulos corretos;
3. reduzir páginas monolíticas de maior risco;
4. eliminar alertas de segurança críticos do Supabase;
5. adicionar testes de integração/regressão para Orçamento, RH e Engenharia;
6. concluir o refinamento das telas ainda cruas e auditar cada módulo com nota mínima 9,0/10.

Enquanto esses itens não forem concluídos, a regra é: **não aumentar a dívida técnica**. Durante o refinamento total, cada área concluída deve reduzir o baseline de dívida correspondente e atingir **mínimo 9,0/10** antes de avançar.