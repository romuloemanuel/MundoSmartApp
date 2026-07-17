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

# Porta interna do Kestrel dentro do container
ENV ASPNETCORE_URLS=http://+:5276
EXPOSE 5276

# Diretório persistível de uploads
RUN mkdir -p /app/uploads

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "MundoSmart.BlingAssistencia.API.dll"]
