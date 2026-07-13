import { SYSTEM_VERSION } from "./version.js";

export const openApiDocument = {
  openapi: "3.1.0",
  info: { title: "AMT Brasil API", version: SYSTEM_VERSION, description: "REST API para clientes, agenda e gestao pessoal." },
  servers: [{ url: "http://localhost:3333/api" }],
  components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } },
  paths: {
    "/auth/login": { post: { summary: "Autentica usuario" } },
    "/auth/refresh": { post: { summary: "Renova tokens" } },
    "/communication/track/open/{token}.gif": { get: { summary: "Registra a abertura de um e-mail e retorna um pixel transparente" } },
    "/dashboard": { get: { summary: "Indicadores e graficos", security: [{ bearerAuth: [] }] } },
    "/clients": { get: { summary: "Lista clientes" }, post: { summary: "Cria cliente" } },
    "/clients/{id}": { get: { summary: "Detalhe e historico" }, put: { summary: "Atualiza cliente" }, delete: { summary: "Exclui cliente" } },
    "/projects": { get: { summary: "Lista projetos" }, post: { summary: "Cria projeto" } },
    "/projects/{id}": { get: { summary: "Detalhe do projeto" }, put: { summary: "Atualiza projeto" }, delete: { summary: "Exclui projeto" } },
    "/schedules": { get: { summary: "Lista agenda" }, post: { summary: "Cria compromisso" } },
    "/tasks": { get: { summary: "Lista tarefas" }, post: { summary: "Cria tarefa" } },
    "/categories": { get: { summary: "Lista categorias" }, post: { summary: "Cria categoria" } },
    "/notes": { get: { summary: "Lista observacoes" }, post: { summary: "Cria observacao" } },
    "/users": { get: { summary: "Lista usuarios administrativamente" }, post: { summary: "Cria usuario" } },
    "/reports/clients.pdf": { get: { summary: "Exporta PDF" } },
    "/reports/clients.csv": { get: { summary: "Exporta Excel CSV" } }
  }
} as const;
