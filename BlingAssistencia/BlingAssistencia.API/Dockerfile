# syntax=docker/dockerfile:1

# ── Build ──────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restaura dependências primeiro (melhor cache de camadas)
COPY BlingAssistencia.API.csproj ./
RUN dotnet restore BlingAssistencia.API.csproj

# Copia o restante do código e publica
COPY . ./
RUN dotnet publish BlingAssistencia.API.csproj -c Release -o /app/publish /p:UseAppHost=false

# ── Runtime ────────────────────────────────────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# Ambiente de produção por padrão (evita subir em modo Development no deploy).
ENV ASPNETCORE_ENVIRONMENT=Production
# Porta interna do Kestrel dentro do container (aponte o proxy do Easypanel aqui).
ENV ASPNETCORE_URLS=http://+:5276
EXPOSE 5276

# Diretório de uploads (fotos de OS). No Easypanel, monte um volume
# persistente em /app/uploads para não perder as imagens a cada deploy.
RUN mkdir -p /app/uploads

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "MundoSmart.BlingAssistencia.API.dll"]
