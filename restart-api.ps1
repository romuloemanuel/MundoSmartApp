# Reinicia a API MundoSmart na porta 5276 (sem Swagger/Swashbuckle)
$port = 5276
$project = Join-Path $PSScriptRoot "BlingAssistencia\BlingAssistencia.API\BlingAssistencia.API.csproj"

Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { if ($_ -gt 0) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }

Start-Sleep -Seconds 1

Push-Location (Split-Path $project)
dotnet clean
dotnet build
if ($LASTEXITCODE -ne 0) { Pop-Location; exit $LASTEXITCODE }
dotnet run --launch-profile http
Pop-Location
