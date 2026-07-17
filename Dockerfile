#See https://aka.ms/customizecontainer to learn how to customize your debug container and how Visual Studio uses this Dockerfile to build your images for faster debugging.

FROM mcr.microsoft.com/dotnet/aspnet:6.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /src
COPY ["Talkbot.Api/Talkbot.Api.csproj", "Talkbot.Api/"]
COPY ["Talkbot.Application/Talkbot.Application.csproj", "Talkbot.Application/"]
RUN dotnet restore "Talkbot.Api/Talkbot.Api.csproj"
COPY . .
WORKDIR "/src/Talkbot.Api"
RUN dotnet build "Talkbot.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Talkbot.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Talkbot.Api.dll"]