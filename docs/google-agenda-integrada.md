# Google Agenda Integrada

## Objetivo

A agenda do sistema pode ser conectada ao Google Calendar. Ao criar, editar, mover ou excluir um compromisso local, o sistema sincroniza automaticamente o evento correspondente na agenda Google conectada.

A agenda local continua sendo a fonte operacional do sistema. Os dados sao persistidos no PostgreSQL via Prisma.

## Configuracao Google Cloud

Crie um OAuth Client no Google Cloud Console:

- Tipo: Web application
- Authorized redirect URI: `http://localhost:3333/api/google-calendar/callback`
- Escopo usado: `https://www.googleapis.com/auth/calendar.events`

Opcionalmente, configure o `.env` para credenciais padrao:

```bash
GOOGLE_CLIENT_ID="seu-client-id"
GOOGLE_CLIENT_SECRET="seu-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3333/api/google-calendar/callback"
```

Tambem e possivel informar as credenciais manualmente na tela `/agenda` ao clicar em `Conectar Google`.
Nesse caso, o usuario informa:

- Google Client ID
- Google Client Secret
- Redirect URI
- ID da agenda (`primary` ou algo como `agenda@group.calendar.google.com`)

As credenciais manuais ficam criptografadas e vinculadas ao usuario conectado. Isso permite conectar agendas Google diferentes por usuario ou agendas compartilhadas.

## Banco de Dados

Migration:

- `backend/prisma/migrations/20260604101954_google_agenda_integrada/migration.sql`

Novos campos em `compromissos`:

- `googleEventId`
- `googleCalendarId`
- `googleSyncedAt`
- `googleSyncStatus`

Nova tabela:

- `conexoes_google_agenda`

Os tokens OAuth sao criptografados com AES-256-GCM usando chave derivada de `JWT_REFRESH_SECRET`.

## Endpoints

Rotas protegidas:

- `GET /api/google-calendar/status`
- `GET /api/google-calendar/auth-url`
- `POST /api/google-calendar/auth-url`
- `DELETE /api/google-calendar`

Callback publico OAuth:

- `GET /api/google-calendar/callback`

## Operacao

1. Acesse `/agenda`.
2. Clique em `Conectar Google`.
3. Autorize a conta Google.
4. Novos compromissos passam a ser sincronizados automaticamente.

Se uma sincronizacao falhar, o compromisso permanece salvo no banco local e recebe `googleSyncStatus = ERROR`.
