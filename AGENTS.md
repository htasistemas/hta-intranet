# AMT Brasil Engineering Rules

## Padroes obrigatorios

- Utilizar TypeScript estrito e nunca utilizar `any`.
- Criar tipagens completas e codigo sem duplicacao.
- Criar componentes pequenos, acessiveis, responsivos e reutilizaveis.
- Separar logica, UI, servicos e tipos.
- Aplicar SOLID, Clean Architecture, Repository Pattern e Service Layer.
- Utilizar Zod em todas as entradas de dados e React Hook Form em formularios.
- Implementar loading states, skeleton loaders, toasts e tratamento global de erros.
- Manter tema dark nativo e visual corporativo consistente.
- Documentar API e operacao do projeto.

## Banco e seguranca

- PostgreSQL com Prisma ORM, migrations versionadas e seeds iniciais.
- JWT com refresh token, senha com bcrypt e middleware de autenticacao.
- Helmet, CORS, rate limiting e validacao de ambiente.

## Performance

- Aplicar lazy loading e code splitting em rotas de interface.
- Utilizar memoizacao apenas em calculos ou componentes mensuravelmente relevantes.
- Listagens de API devem aceitar paginacao, filtros, ordenacao e busca otimizada.
