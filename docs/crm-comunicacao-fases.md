# CRM Comunicacao, Campanhas e Inteligencia

## Fase 1 - Controle eficiente de clientes e disparos manuais

Implementado:

- Templates de e-mail e WhatsApp com variaveis `{{cliente}}`, `{{empresa}}`, `{{email}}`, `{{whatsapp}}` e campos adicionais enviados na requisicao.
- Configuracao de provedores por usuario e canal.
- Disparo manual para lead ou cliente.
- Historico de mensagens no CRM e no Portal 360 do cliente.
- Status de mensagem: `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`.

Endpoints:

- `GET /api/communication/provider-configs`
- `POST /api/communication/provider-configs`
- `GET /api/communication/templates`
- `POST /api/communication/templates`
- `GET /api/communication/messages`
- `POST /api/communication/send`

## Fase 2 - Fila, automacoes e campanhas

Implementado:

- Fila de envio persistida em `crm_fila_comunicacao`.
- Processamento manual da fila.
- Campanhas segmentadas por canal, cidade, estado e segmento.
- Relatorio de comunicacao com mensagens por status/canal.

Endpoints:

- `POST /api/communication/queue/process`
- `GET /api/communication/campaigns`
- `POST /api/communication/campaigns`
- `POST /api/communication/campaigns/:id/run`
- `GET /api/communication/report`

## Fase 3 - CRM avancado

Implementado:

- Score de clientes por engajamento, contratos, projetos e inatividade.
- Metas comerciais.
- Regras de SLA por etapa/prioridade.
- Alertas de SLA.
- Webhooks para atualizar entrega/leitura/falha de mensagens.

Endpoints:

- `POST /api/crm/scores/calculate`
- `GET /api/crm/goals`
- `POST /api/crm/goals`
- `GET /api/crm/sla-rules`
- `POST /api/crm/sla-rules`
- `GET /api/crm/sla-alerts`
- `POST /api/communication/webhooks`

## Provedores

O envio usa provider configuravel:

- `WEBHOOK`
- `RESEND`
- `SENDGRID`
- `META_WHATSAPP`
- `ZAPI`
- `EVOLUTION`
- `SMTP`

Quando nao ha provider ativo, o sistema registra envio simulado com identificador `SIM-*`. Isso permite testar fluxo, historico, fila, campanhas e relatorios sem depender de credenciais externas.

Para envio real, configure `endpointUrl`, `apiKey` e remetente na aba `Comunicacao` do CRM.
