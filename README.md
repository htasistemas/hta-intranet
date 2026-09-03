# Torresoft Intranet

Plataforma full stack para controle de clientes, agenda e gestao pessoal, com interface dark corporativa e API REST segura.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, componentes no padrao shadcn/ui, TanStack Query, React Hook Form, Zod, Recharts, FullCalendar e dnd-kit.
- Backend: Node.js, Express, TypeScript, Prisma e PostgreSQL.
- Seguranca: JWT de curta duracao, rotacao de refresh token, bcrypt, Helmet, CORS, rate limiting e validacao Zod.

## Modulos entregues

- Dashboard com oito KPIs e graficos de clientes, categorias, produtividade e compromissos.
- Clientes com cadastro completo, pesquisa, categorias, receita prevista, edicao e exportacao.
- Projetos empresariais com cliente vinculado, prazo, orcamento, progresso, prioridade e integracao com tarefas.
- Agenda com visoes mensal, semanal, diaria e lista; criacao/edicao modal, cores, lembrete, recorrencia e drag-and-drop.
- Gestao pessoal em Kanban persistente com prioridades, prazos e movimentacao por dnd-kit.
- Relatorios exportaveis em PDF e CSV compativel com Excel.
- Configuracoes de perfil, tema e notificacoes.
- Historico automatico (`registros_auditoria`) de alteracoes relevantes.

## Arquitetura

```text
torresoft/
  frontend/src/
    components/  contexts/  hooks/  layouts/  lib/  pages/  services/  types/
  backend/
    prisma/      src/controllers/ routes/ middleware/ repositories/ services/
```

O backend separa entrada HTTP (`controllers`/`routes`), regras de aplicacao (`services`) e persistencia (`repositories`). O frontend separa UI, sessao, comunicacao HTTP e telas carregadas com code splitting.

## Requisitos

- Node.js 20 ou superior
- npm 10 ou superior
- PostgreSQL 16 ou Docker Desktop

## Instalacao

Na raiz `torresoft`:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm install
docker compose up -d postgres
npm run db:migrate
npm run db:seed
npm run dev
```

No Windows PowerShell, crie o ambiente com:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Aplicacao web: `http://localhost:5173`  
API: `http://localhost:3333/api`  
Health check: `http://localhost:3333/health`  
OpenAPI JSON: `http://localhost:3333/api/docs`

## Acesso inicial

```text
Email: adrianomtorresbr@gmail.com
Senha: definida no seed inicial
```

Troque a senha e os segredos JWT antes de qualquer publicacao.

## Variaveis de ambiente

| Variavel | Descricao |
| --- | --- |
| `DATABASE_URL` | Conexao PostgreSQL utilizada pelo Prisma |
| `PORT` | Porta HTTP da API |
| `FRONTEND_URL` | Origem permitida pelo CORS |
| `JWT_SECRET` | Segredo do access token, minimo 32 caracteres |
| `JWT_REFRESH_SECRET` | Segredo independente do refresh token |
| `JWT_EXPIRES_IN` | Duracao do token de acesso |
| `JWT_REFRESH_EXPIRES_IN` | Duracao do refresh token |
| `VITE_API_URL` | URL consumida pelo frontend |

## Banco de dados

O schema Prisma contém as tabelas fisicas em portugues brasileiro:

- `usuarios`, `clientes`, `projetos`, `contatos_clientes`, `compromissos`, `tarefas`, `colunas_tarefas`
- `observacoes`, `lembretes`, `categorias`, `etiquetas`, `anexos`, `registros_auditoria`
- `tokens_renovacao` para rotacao e revogacao segura de sessao

O Prisma mantem ainda a tabela tecnica `_prisma_migrations`, necessaria para controlar migrations.

A seed cria categorias, colunas Kanban, usuario administrador, clientes ficticios, compromissos, tarefas, notas e registros de auditoria.

Comandos:

```bash
npm run db:migrate
npm run db:seed
npm exec -w backend prisma studio
```

## API principal

Todas as rotas abaixo, exceto autenticacao e `/api/docs`, exigem `Authorization: Bearer <token>`.

| Recurso | Rotas |
| --- | --- |
| Autenticacao | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` |
| Dashboard | `GET /api/dashboard` |
| Clientes | `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/:id` |
| Projetos | `GET/POST /api/projects`, `GET/PUT/DELETE /api/projects/:id` |
| Agenda | `GET/POST /api/schedules`, `PUT/DELETE /api/schedules/:id` |
| Tarefas | `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`, `GET /api/task-columns` |
| Categorias | `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id` |
| Observacoes | `GET/POST /api/notes`, `PUT/DELETE /api/notes/:id` |
| Usuarios | `GET/POST /api/users`, `PUT/DELETE /api/users/:id` (admin) |
| Perfil | `GET/PUT /api/users/me` |
| Pesquisa | `GET /api/search?q=termo` |
| Exportacao | `GET /api/reports/clients.pdf`, `GET /api/reports/clients.csv` |

Clientes aceitam `page`, `pageSize`, `search`, `sortBy`, `order` e `status`.

## Scripts

```bash
npm run dev       # API e frontend simultaneamente
npm run build     # build de producao dos dois workspaces
npm run lint      # verificacao TypeScript estrita
npm run db:migrate
npm run db:seed
```

## Producao

Antes do deploy:

1. Substitua as credenciais e segredos de `.env`.
2. Use PostgreSQL gerenciado com backup e TLS.
3. Execute migrations no pipeline de entrega.
4. Publique o build de `frontend/dist` em CDN/proxy e execute `backend/dist/server.js`.
5. Restrinja `FRONTEND_URL`, adicione observabilidade e politica de armazenamento para anexos.

O sistema implementa a base funcional e as medidas de seguranca aplicacionais; operacao realmente produtiva depende desses controles de infraestrutura.

## Deploy Hostinger

O deploy de producao da intranet Torresoft usa Docker Compose com nomes isolados para nao interferir em outros sistemas do servidor:

- Diretorio sugerido: `/home/srv/torresoft-intranet`
- URL publica: `https://intranet.torresoftbrasil.com.br`
- Porta local publicada pelo container frontend: `127.0.0.1:8081`
- Containers de producao existentes: `hta-intranet-postgres`, `hta-intranet-backend`, `hta-intranet-frontend`
- Volume PostgreSQL existente: `hta_intranet_postgres`

O proxy web da Hostinger deve encaminhar `intranet.torresoftbrasil.com.br` para `http://127.0.0.1:8081`, mantendo os demais sites e servicos existentes inalterados.
