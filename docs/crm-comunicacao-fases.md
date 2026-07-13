# CRM Comunicacao, Campanhas e Inteligencia

## Fase 1 - Controle eficiente de clientes e disparos manuais

Implementado:

- Templates de e-mail e WhatsApp com variaveis `{{cliente}}`, `{{empresa}}`, `{{email}}`, `{{whatsapp}}` e campos adicionais enviados na requisicao.
- Configuracao de provedores por usuario e canal.
- Disparo manual para lead ou cliente.
- Historico de mensagens no CRM e no Portal 360 do cliente.
- Status de mensagem: `QUEUED`, `SENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`.
- Rastreamento de abertura de e-mail por pixel individual, com primeira abertura, ultima abertura e contador.

Endpoints:

- `GET /api/communication/provider-configs`
- `POST /api/communication/provider-configs`
- `GET /api/communication/templates`
- `POST /api/communication/templates`
- `GET /api/communication/messages`
- `POST /api/communication/send`
- `GET /api/communication/track/open/:token.gif` (publico, usado somente pela imagem incorporada ao e-mail)

### Confirmacao de abertura

Cada novo e-mail SMTP inclui uma imagem transparente individual. Quando o cliente permite o carregamento de imagens, a mensagem passa para `READ` e o historico registra a primeira abertura e o total de carregamentos. `EMAIL_TRACKING_BASE_URL` deve apontar para a URL HTTPS publica que encaminha `/api` ao backend. Quando ela nao esta configurada, o sistema usa `FRONTEND_URL`.

O rastreamento nao e uma confirmacao absoluta: clientes de e-mail podem bloquear imagens e provedores como Gmail e Apple podem carregar ou armazenar a imagem em proxy. Por isso, uma abertura pode nao ser registrada ou pode ser registrada automaticamente.

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

Para SMTP definido por ambiente, o container do backend deve receber `APP_EMAIL_HABILITADO`, `APP_EMAIL_REMETENTE`, `APP_EMAIL_NOME`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER` e `MAIL_PASS`. No Gmail, `MAIL_PASS` deve ser uma senha de app, e nao a senha comum da conta.
