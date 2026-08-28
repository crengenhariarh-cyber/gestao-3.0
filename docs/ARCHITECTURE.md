# Arquitetura — Gestão 3.0

## Regra fundamental

O sistema é um monólito modular. Módulos compartilham a aplicação, mas não compartilham regras internas de forma descontrolada.

## Camadas por módulo

Cada domínio pode conter:

- `domain/`: entidades, value objects, enums e regras puras;
- `application/`: casos de uso e contratos;
- `infrastructure/`: repositories, Supabase e integrações;
- `ui/`: páginas, componentes e hooks de apresentação.

## Módulos

- `platform`
- `registrations`
- `finance`
- `budget`
- `hr`
- `contracts`
- `production`
- `reports`
- `master`

## Dependências

1. UI não acessa Supabase diretamente.
2. Regra de negócio não depende de React.
3. RH, contratos e produção não gravam diretamente no Financeiro.
4. Integrações entre domínios passam por casos de uso/contratos explícitos.
5. Operações críticas devem ser idempotentes e auditáveis.
6. Segurança não depende de filtros da interface: RLS é a autoridade.
7. `tenant_id` e `company_id` são estruturais.
8. Nenhuma relação de negócio permanente será resolvida por nome/alias textual.

## Design System

Componentes visuais reutilizáveis vivem em `src/shared/ui`. Páginas não criam versões locais de botão, modal, input, tabela, feedback, loading ou confirmação para contornar o Design System.

## Dados

O novo banco será criado por migrations versionadas. O schema legado do Gestão 2.0 não será copiado. Dados históricos serão migrados posteriormente por transformação controlada.