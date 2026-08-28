# Banco de dados — Gestão 3.0

## Princípios

O banco do Gestão 3.0 nasce limpo e por migrations versionadas. O schema do Gestão 2.0 não será copiado.

- `tenant_id` e `company_id` são fronteiras estruturais de isolamento.
- RLS é obrigatória e deve existir desde o nascimento das tabelas expostas.
- A UI não acessa Supabase diretamente; acesso ocorre por repositories/casos de uso.
- Regras críticas devem ser transacionais, idempotentes, auditáveis e testadas.
- `SECURITY DEFINER` é excepcional e exige justificativa e revisão explícita.
- Relações de negócio usam UUID/FK, nunca nome/alias textual como vínculo permanente.
- Histórico financeiro, RH, contratos, produção e auditoria não usa exclusão em cascata indiscriminada.

## Fundação 3.4

A primeira migration cria somente a base de identidade organizacional:

- `tenants`
- `profiles`
- `companies`
- `tenant_memberships`
- `company_memberships`
- `audit_log`

Todas as tabelas nascem com RLS habilitada e sem políticas permissivas. Portanto, o comportamento inicial é deny-by-default. As políticas de autenticação, tenant e company serão adicionadas e testadas na Fase 3.5.

## Estratégia de migrations

- Uma alteração estrutural relevante = uma nova migration.
- Migration aplicada nunca é editada para esconder drift; uma correção gera migration posterior.
- Desenvolvimento e homologação aplicam migrations antes de produção.
- Dados legados serão migrados posteriormente por transformação controlada, não por clone do schema antigo.

## Auditoria

`audit_log` é a fundação para registrar ações críticas como pagamento, fechamento, reabertura, aprovação e conversão. A política final de escrita será definida junto com autenticação/RLS.

## Estado atual

A estrutura de migrations está versionada no repositório. A aplicação no novo projeto Supabase depende da criação do projeto Gestão 3.0 separado.
