# Homologação — Gestão 3.0

## Objetivo

Preparar o Gestão 3.0 para um primeiro ambiente de validação sem publicar ou implantar nada sem autorização explícita.

## Regra de bloqueio

Nenhum deploy, publicação, link público, troca de domínio ou substituição do Gestão 2.0 pode ocorrer automaticamente.

A etapa 3.8 só será considerada concluída depois de autorização explícita para criar o primeiro ambiente acessível.

## Pré-requisitos técnicos já concluídos

- CI verde com typecheck, lint, testes e build.
- Supabase do Gestão 3.0 separado do Gestão 2.0.
- RLS e isolamento por tenant/empresa validados.
- Login, shell, navegação e seletor de empresa implementados.
- UI Lab disponível no código como referência visual.
- Testes de regressão de contexto de empresa.

## Gates obrigatórios antes de publicar

1. CI da branch alvo deve estar verde.
2. Advisors de segurança do Supabase sem vulnerabilidades pendentes.
3. Nenhum segredo pode estar versionado no repositório.
4. Variáveis do ambiente devem apontar exclusivamente para o Supabase do Gestão 3.0.
5. O ambiente de homologação não pode compartilhar domínio nem banco com o Gestão 2.0.
6. O acesso deve exigir autenticação.
7. A publicação deve ser uma ação manual e explicitamente autorizada.

## Estado atual

Estrutura preparada. Publicação bloqueada por decisão de projeto.
