# Deploy Hostinger Torresoft

Este procedimento publica a intranet em `https://intranet.torresoftbrasil.com.br` sem substituir servicos existentes no servidor.

## Estrategia

- Manter o sistema em `/home/srv/torresoft-intranet`.
- Manter o compose `intranet-hta` e os containers `hta-intranet-*` para preservar o volume de producao existente.
- Publicar somente `127.0.0.1:8081:80`.
- Configurar o proxy publico da Hostinger/Nginx para encaminhar o dominio para `127.0.0.1:8081`.

## Variaveis

Crie `/home/srv/hta-intranet/.env.production` a partir de `.env.production.example` e substitua:

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- credenciais de e-mail, se o envio SMTP estiver habilitado
- `GOOGLE_CLIENT_ID`, se login Google estiver habilitado

## Comandos

```bash
cd /home/srv/hta-intranet
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:migrate
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:seed
```

## Proxy Nginx do host

```nginx
server {
  listen 80;
  server_name intranet.torresoftbrasil.com.br;

  location / {
    proxy_pass http://127.0.0.1:8081;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Depois de apontar o DNS, emita TLS sem alterar outros vhosts:

```bash
certbot --nginx -d intranet.torresoftbrasil.com.br
```

## Validacao

```bash
curl -I http://127.0.0.1:8081/health
curl -I https://intranet.torresoftbrasil.com.br/health
```
