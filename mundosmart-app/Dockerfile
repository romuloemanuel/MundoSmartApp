# syntax=docker/dockerfile:1

# ── Build (Angular) ────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Instala dependências com base no lockfile (melhor cache)
COPY package*.json ./
RUN npm ci

# Copia o restante e gera o build de produção
COPY . ./
RUN npm run build

# ── Runtime (nginx) ────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

# Config que serve o SPA e faz proxy de /api e /uploads para a API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Artefatos do build do Angular (application builder => browser/)
COPY --from=build /app/dist/mundosmart-app/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
