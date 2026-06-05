# Melhorias CRM Enterprise

Implementacoes adicionadas a partir do benchmark com Salesforce, HubSpot, Pipedrive e monday CRM.

## Enriquecimento automatico

No cadastro de clientes:

- Busca de CEP por BrasilAPI.
- Busca de CNPJ por BrasilAPI.
- Preenchimento automatico de empresa, telefone, e-mail e endereco.
- Mascaras de CPF, CNPJ, CEP, telefone e WhatsApp.
- Campos condicionais para pessoa fisica e empresa.
- Vinculo de cliente com projetos.

Endpoints:

- `GET /api/lookup/cep/:cep`
- `GET /api/lookup/cnpj/:cnpj`

## Inteligencia operacional

Novos recursos:

- Resumo inteligente do cliente.
- Proxima melhor acao.
- Mensagem sugerida.
- Risco comercial.
- Probabilidade por etapa do funil.
- Valor ponderado do pipeline.
- Insights do pipeline.

Endpoints:

- `GET /api/crm/clients/:id/intelligence`
- `GET /api/crm/leads/:id/intelligence`
- `GET /api/crm/pipeline/insights`

## Portal Cliente

Nova rota:

- `/portal-cliente`

Exibe:

- Dados do cliente.
- Score.
- Proxima melhor acao.
- Projetos.
- Propostas.
- Contratos.
- Comunicacoes.

## Pipeline

Dashboard comercial passa a considerar:

- Valor total em negociacao.
- Valor ponderado do pipeline por probabilidade de etapa.
- Alertas operacionais via SLA.

## Observacao

A inteligencia implementada e baseada em regras e dados internos do CRM. Ela nao depende de provider externo de IA, evitando custo e falha operacional. Pode ser evoluida depois para LLM/API quando houver chave e politica de uso definida.
