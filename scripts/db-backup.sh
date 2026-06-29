#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
ENV_FILE="${ENV_FILE:-}"
SERVICE="${SERVICE:-postgres}"
OUTPUT_DIR="${OUTPUT_DIR:-backups}"
LABEL="${LABEL:-backup}"
DATABASE="${DATABASE:-\${POSTGRES_DB}}"
USER_NAME="${USER_NAME:-\${POSTGRES_USER}}"

mkdir -p "$OUTPUT_DIR"

COMPOSE_ARGS="-f $COMPOSE_FILE"
if [ -n "$ENV_FILE" ]; then
  COMPOSE_ARGS="--env-file $ENV_FILE $COMPOSE_ARGS"
fi

CONTAINER_ID="$(docker compose $COMPOSE_ARGS ps -q "$SERVICE")"
if [ -z "$CONTAINER_ID" ]; then
  echo "Container do servico '$SERVICE' nao encontrado." >&2
  exit 1
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_LABEL="$(printf '%s' "$LABEL" | tr -c 'a-zA-Z0-9_.-' '-')"
FILE_NAME="$SAFE_LABEL-$TIMESTAMP.dump"
LOCAL_PATH="$OUTPUT_DIR/$FILE_NAME"
CONTAINER_PATH="/tmp/$FILE_NAME"

docker compose $COMPOSE_ARGS exec -T "$SERVICE" sh -lc "pg_dump -U \"$USER_NAME\" -d \"$DATABASE\" -F c -f \"$CONTAINER_PATH\""
docker cp "$CONTAINER_ID:$CONTAINER_PATH" "$LOCAL_PATH"
docker compose $COMPOSE_ARGS exec -T "$SERVICE" rm -f "$CONTAINER_PATH" >/dev/null

echo "Backup criado em: $LOCAL_PATH"
