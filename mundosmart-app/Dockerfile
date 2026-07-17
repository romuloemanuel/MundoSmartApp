# syntax=docker/dockerfile:1

# ── Build (Angular) ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
ENV APP_ENV=prd

# Instala dependências com base no lockfile (melhor cache)
COPY package*.json ./
RUN npm ci

# Copia o restante e gera o build de produção
COPY . ./
RUN npm run build

# ── Runtime (nginx) ────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Identifica explicitamente este container como frontend de produção.
ENV APP_ENV=prd
# Endereço interno da API — sobrescreva via env no deploy
# (compose: http://api:5276 | Easypanel: http://<projeto>_<app-api>:5276)
ENV API_URL=http://api:5276

# Template processado pelo entrypoint do nginx (envsubst) na subida
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Artefatos do build do Angular (application builder => browser/)
COPY --from=build /app/dist/mundosmart-app/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
