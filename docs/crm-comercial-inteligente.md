# CRM Comercial Inteligente

## Visao Geral

O modulo CRM Comercial Inteligente gerencia a jornada comercial completa: lead, oportunidade, cliente, proposta, contrato, ordem de servico, projeto, tarefas, timeline, automacoes e relatorios.

Todos os dados sao persistidos no PostgreSQL via Prisma. A interface nao grava cadastros em storage local; `localStorage` permanece restrito a sessao/autenticacao existente e preferencia de menu lateral.

## Banco de Dados

Migration criada:

- `backend/prisma/migrations/20260604021224_crm_comercial_inteligente/migration.sql`

Tabelas principais:

- `crm_leads`
- `crm_clientes`
- `crm_atividades`
- `crm_propostas`
- `crm_contratos`
- `crm_projetos`
- `crm_tarefas_projetos`
- `crm_automacoes`

Os registros possuem:

- `tenantId` para isolamento multiempresa.
- `ownerId` para isolamento por usuario autenticado.
- `deletedAt` para soft delete.
- `createdAt` e `updatedAt` para auditoria temporal.

## Backend

Arquivos principais:

- `backend/src/controllers/crm.controller.ts`
- `backend/src/services/crm.service.ts`
- `backend/src/repositories/crm.repository.ts`
- `backend/src/validations/entities.validation.ts`

Rotas protegidas por JWT:

- `GET /api/crm/dashboard`
- `GET /api/crm/leads`
- `GET /api/crm/leads/:id`
- `POST /api/crm/leads`
- `PUT /api/crm/leads/:id`
- `PUT /api/crm/leads/:id/stage`
- `POST /api/crm/leads/:id/convert`
- `DELETE /api/crm/leads/:id`
- `GET /api/crm/clients`
- `GET /api/crm/clients/:id`
- `GET /api/crm/activities`
- `POST /api/crm/activities`
- `GET /api/crm/proposals`
- `POST /api/crm/proposals`
- `PUT /api/crm/proposals/:id`
- `GET /api/crm/contracts`
- `POST /api/crm/contracts`
- `GET /api/crm/projects`
- `POST /api/crm/projects`
- `PUT /api/crm/projects/:id`
- `POST /api/crm/project-tasks`
- `GET /api/crm/automations`
- `POST /api/crm/automations`
- `PUT /api/crm/automations/:id`
- `GET /api/crm/reports`
- `GET /api/crm/reports.csv`
- `GET /api/crm/reports.pdf`
- `GET /api/crm/reports.xls`

## Frontend

Rota:

- `/crm-comercial`

Arquivos principais:

- `frontend/src/pages/crm-page.tsx`
- `frontend/src/components/crm/crm-forms.tsx`
- `frontend/src/components/crm/crm-kanban.tsx`
- `frontend/src/types/crm.ts`

Recursos implementados:

- Dashboard comercial com Recharts.
- Cadastro completo de leads com React Hook Form e Zod.
- Funil de vendas Kanban com DnD Kit.
- Timeline e agenda de atividades.
- Propostas comerciais com status e versao.
- Contratos e ordem de servico criados automaticamente ao converter venda.
- Gestao de projetos com Kanban DnD.
- Portal 360 do cliente.
- Automacoes parametrizaveis.
- Relatorios CSV, PDF e Excel.

## Operacao

Aplicar migrations:

```bash
npm run db:migrate
```

Validar build:

```bash
npm run build
```

Rodar em desenvolvimento:

```bash
npm run dev
```

Depois acesse:

- Frontend: `http://localhost:5173/crm-comercial`
- API: `http://localhost:3333/api/crm/dashboard`
