#!/usr/bin/env sh
set -eu

if [ "${1:-}" = "" ]; then
  echo "Uso: scripts/db-restore.sh caminho/do/backup.dump" >&2
  exit 1
fi

BACKUP_FILE="$1"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-}"
SERVICE="${SERVICE:-postgres}"
DATABASE="${DATABASE:-\${POSTGRES_DB}}"
USER_NAME="${USER_NAME:-\${POSTGRES_USER}}"
SKIP_CONFIRM="${YES:-}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Arquivo de backup nao encontrado: $BACKUP_FILE" >&2
  exit 1
fi

if [ "$SKIP_CONFIRM" != "1" ]; then
  echo "ATENCAO: a restauracao apaga/substitui objetos existentes no banco de destino."
  printf "Digite RESTAURAR para continuar: "
  read -r CONFIRMATION
  if [ "$CONFIRMATION" != "RESTAURAR" ]; then
    echo "Restauracao cancelada." >&2
    exit 1
  fi
fi

COMPOSE_ARGS="-f $COMPOSE_FILE"
if [ -n "$ENV_FILE" ]; then
  COMPOSE_ARGS="--env-file $ENV_FILE $COMPOSE_ARGS"
fi

CONTAINER_ID="$(docker compose $COMPOSE_ARGS ps -q "$SERVICE")"
if [ -z "$CONTAINER_ID" ]; then
  echo "Container do servico '$SERVICE' nao encontrado." >&2
  exit 1
fi

FILE_NAME="$(basename "$BACKUP_FILE")"
CONTAINER_PATH="/tmp/$FILE_NAME"

docker cp "$BACKUP_FILE" "$CONTAINER_ID:$CONTAINER_PATH"
docker compose $COMPOSE_ARGS exec -T "$SERVICE" sh -lc "pg_restore -U \"$USER_NAME\" -d \"$DATABASE\" --clean --if-exists --no-owner --no-privileges \"$CONTAINER_PATH\""
docker compose $COMPOSE_ARGS exec -T "$SERVICE" rm -f "$CONTAINER_PATH" >/dev/null

echo "Backup restaurado com sucesso em: $BACKUP_FILE"
