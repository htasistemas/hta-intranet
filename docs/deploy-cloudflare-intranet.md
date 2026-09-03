# Deploy em intranet.torresoftbrasil.com.br

Este guia publica o sistema em uma VPS com Docker e usa o Cloudflare como DNS/proxy.

## 1. Servidor

Instale Docker e Docker Compose no servidor Linux e libere as portas:

- `80/tcp`
- `443/tcp`, se for instalar TLS no servidor

Clone o repositorio:

```bash
git clone git@github.com:htasistemas/hta-intranet.git /home/srv/hta-intranet
cd /home/srv/hta-intranet
cp .env.production.example .env.production
```

Edite `.env.production` e troque todas as senhas e segredos.

Suba os containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T backend npm exec -w backend prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:seed
```

Teste no servidor:

```bash
curl http://127.0.0.1:8081/health
```

## 2. Mesmo servidor de outros servicos

Como a intranet vai rodar no mesmo servidor de outros servicos, o container publica a aplicacao somente em:

```text
http://127.0.0.1:8081
```

Assim, ele nao disputa as portas publicas `80` e `443` com os sites atuais. O Nginx, Apache, Caddy ou outro proxy principal do servidor deve receber `intranet.torresoftbrasil.com.br` e encaminhar para `127.0.0.1:8081`.

Exemplo com Nginx no host:

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

Recarregue o Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Se usar Certbot:

```bash
sudo certbot --nginx -d intranet.torresoftbrasil.com.br
```

## 3. Cloudflare DNS

No Cloudflare, em `torresoftbrasil.com.br`:

| Tipo | Nome | Conteudo | Proxy |
| --- | --- | --- | --- |
| A | `intranet` | IP publico da VPS | Proxied |

Se o provedor der um hostname em vez de IP, use `CNAME`:

| Tipo | Nome | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `intranet` | hostname do provedor | Proxied |

## 4. SSL/TLS

Recomendado para producao:

1. Instale um certificado valido no servidor, via Let's Encrypt ou Cloudflare Origin Certificate.
2. No Cloudflare, configure `SSL/TLS > Overview > Full (strict)`.

Para teste inicial sem TLS no servidor, `Flexible` pode funcionar, mas nao e recomendado para producao.

## 5. Validacao

Acesse:

```text
https://intranet.torresoftbrasil.com.br
https://intranet.torresoftbrasil.com.br/health
```

## 6. Atualizacao

```bash
cd /home/srv/hta-intranet
git pull --ff-only
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T backend npm exec -w backend prisma migrate deploy
```

## 7. Deploy automatico pelo GitHub

O workflow `.github/workflows/deploy.yml` executa automaticamente a cada push na branch `master`. O servidor precisa ter um GitHub Actions Runner dedicado ao repositorio, executado pelo usuario `srv`, com os labels `self-hosted` e `hta-intranet`.

O checkout de producao e o ambiente ficam em `/home/srv/hta-intranet` e `/home/srv/hta-intranet/.env.production`. O usuario do runner precisa ter acesso ao Docker sem `sudo`.
