# Backup e restauracao do PostgreSQL

Este guia serve para copiar dados da base de teste para a base de producao usando `pg_dump` e `pg_restore` dentro do container PostgreSQL.

## Regras de seguranca

- Faca backup da producao antes de qualquer restore.
- Nunca restaure em producao sem confirmar que o arquivo veio da base correta.
- O restore usa `--clean --if-exists`, portanto objetos existentes no banco de destino podem ser apagados/substituidos.
- Arquivos `.dump` contem dados reais. Nao envie para GitHub, WhatsApp ou e-mail sem criptografia.

## Backup da base de teste no Windows

Na maquina onde esta a base de teste:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\db-backup.ps1 `
  -ComposeFile docker-compose.yml `
  -Service postgres `
  -OutputDir backups `
  -Label teste
```

O arquivo sera criado em `backups/teste-YYYYMMDD-HHMMSS.dump`.

## Backup da producao antes do restore

No servidor de producao, dentro da pasta do projeto:

```bash
COMPOSE_FILE=docker-compose.prod.yml \
ENV_FILE=.env.production \
OUTPUT_DIR=backups \
LABEL=producao-antes-restore \
sh scripts/db-backup.sh
```

Se estiver usando PowerShell no servidor:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\db-backup.ps1 `
  -ComposeFile docker-compose.prod.yml `
  -EnvFile .env.production `
  -Service postgres `
  -OutputDir backups `
  -Label producao-antes-restore
```

## Enviar o backup de teste para o servidor

Copie o arquivo `.dump` gerado no teste para a pasta `backups/` do servidor de producao.

Exemplo com `scp`:

```bash
scp backups/teste-YYYYMMDD-HHMMSS.dump usuario@servidor:/caminho/hta-intranet/backups/
```

## Restaurar na producao

No servidor de producao:

```bash
COMPOSE_FILE=docker-compose.prod.yml \
ENV_FILE=.env.production \
sh scripts/db-restore.sh backups/teste-YYYYMMDD-HHMMSS.dump
```

O script pedira confirmacao. Digite exatamente:

```text
RESTAURAR
```

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\db-restore.ps1 `
  -BackupFile backups\teste-YYYYMMDD-HHMMSS.dump `
  -ComposeFile docker-compose.prod.yml `
  -EnvFile .env.production `
  -Service postgres
```

## Validacao apos restaurar

Execute migrations para garantir compatibilidade do schema:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:migrate
```

Reinicie os servicos:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Confira a aplicacao:

```bash
curl -I https://intranet.htasistemas.com.br
curl -I https://intranet.htasistemas.com.br/health
```

## Restaurar localmente para testar um dump

```powershell
powershell -ExecutionPolicy Bypass -File scripts\db-restore.ps1 `
  -BackupFile backups\teste-YYYYMMDD-HHMMSS.dump `
  -ComposeFile docker-compose.yml `
  -Service postgres
```

## Observacoes

- Os scripts usam o servico `postgres` do Docker Compose.
- Em desenvolvimento, as credenciais do banco estao em `docker-compose.yml`.
- Em producao, as credenciais sao lidas de `.env.production` pelo `docker compose`.
- Para automacao sem pergunta de confirmacao, use `YES=1` no Linux ou `-Yes` no PowerShell. Use isso apenas em rotina controlada.
