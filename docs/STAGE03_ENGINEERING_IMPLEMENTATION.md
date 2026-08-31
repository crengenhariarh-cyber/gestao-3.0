# Etapa 03/04 — Engenharia operacional

Pacote único, sem deploy intermediário.

Escopo operacional implementado:
- cadastro de obra e estrutura hierárquica;
- contratos, status, serviços e distribuição por estrutura;
- provisórios, itens e conversão em contrato/aditivo;
- aditivos e linhas de acréscimo/redução/ajuste;
- medições, itens, retenções, fechamento/aprovação/reabertura/cancelamento;
- geração de conta a receber e registro de recebimento;
- produção por período, colaborador, estrutura e serviço;
- fechamento e reabertura de produção;
- isolamento por tenant_id + company_id e reutilização das RLS/RPCs existentes.

A homologação depende de CI verde e regressão estrutural final no Supabase.
