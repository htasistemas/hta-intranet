# Deploy em intranet.htasistemas.com.br

Este guia publica o sistema em uma VPS com Docker e usa o Cloudflare como DNS/proxy.

## 1. Servidor

Instale Docker e Docker Compose no servidor Linux e libere as portas:

- `80/tcp`
- `443/tcp`, se for instalar TLS no servidor

Clone o repositorio:

```bash
git clone git@github.com:htasistemas/hta-intranet.git
cd hta-intranet
cp .env.production.example .env.production
```

Edite `.env.production` e troque todas as senhas e segredos.

Suba os containers:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:migrate
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:seed
```

Teste no servidor:

```bash
curl http://localhost/health
```

## 2. Cloudflare DNS

No Cloudflare, em `htasistemas.com.br`:

| Tipo | Nome | Conteudo | Proxy |
| --- | --- | --- | --- |
| A | `intranet` | IP publico da VPS | Proxied |

Se o provedor der um hostname em vez de IP, use `CNAME`:

| Tipo | Nome | Target | Proxy |
| --- | --- | --- | --- |
| CNAME | `intranet` | hostname do provedor | Proxied |

## 3. SSL/TLS

Recomendado para producao:

1. Instale um certificado valido no servidor, via Let's Encrypt ou Cloudflare Origin Certificate.
2. No Cloudflare, configure `SSL/TLS > Overview > Full (strict)`.

Para teste inicial sem TLS no servidor, `Flexible` pode funcionar, mas nao e recomendado para producao.

## 4. Validacao

Acesse:

```text
https://intranet.htasistemas.com.br
https://intranet.htasistemas.com.br/health
```

## 5. Atualizacao

```bash
git pull
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
docker compose --env-file .env.production -f docker-compose.prod.yml exec backend npm run db:migrate
```
