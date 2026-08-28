# Gestão 3.0

Reconstrução limpa e profissional do sistema Gestão.

## Princípios

- Não copiar código legado do Gestão 2.0.
- Preservar regras de negócio validadas por meio de uma nova implementação.
- Arquitetura de monólito modular com fronteiras rígidas entre domínios.
- `tenant_id` e `company_id` estruturais.
- Segurança e isolamento garantidos no banco por RLS.
- Design System obrigatório para toda a interface.
- Operações críticas idempotentes, auditáveis e testadas.
- Produção protegida; desenvolvimento e homologação separados.

## Domínios

- Plataforma e identidade
- Cadastros
- Financeiro
- Orçamento
- RH
- Contratos e medições
- Produção
- Relatórios e auditoria
- Portal Master

## Estado

Fase 3 — Fundação Técnica.

Este repositório começa do zero. O Gestão 2.0 permanece apenas como referência funcional e fonte para futura migração controlada de dados.