param(
  [string]$ComposeFile = "docker-compose.yml",
  [string]$EnvFile = "",
  [string]$Service = "postgres",
  [string]$OutputDir = "backups",
  [string]$Database = "",
  [string]$User = "",
  [string]$Label = "backup"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$composeArgs = @("compose")
if ($EnvFile) {
  $composeArgs += @("--env-file", $EnvFile)
}
$composeArgs += @("-f", $ComposeFile)

$containerId = (& docker @composeArgs ps -q $Service).Trim()
if (-not $containerId) {
  throw "Container do servico '$Service' nao encontrado. Suba o banco antes de executar o backup."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = $Label -replace "[^a-zA-Z0-9_.-]", "-"
$fileName = "$safeLabel-$timestamp.dump"
$localPath = Join-Path $OutputDir $fileName
$containerPath = "/tmp/$fileName"

$dbArg = if ($Database) { $Database } else { '${POSTGRES_DB}' }
$userArg = if ($User) { $User } else { '${POSTGRES_USER}' }
$dumpCommand = "pg_dump -U `"$userArg`" -d `"$dbArg`" -F c -f `"$containerPath`""

& docker @composeArgs exec -T $Service sh -lc $dumpCommand
& docker cp "${containerId}:$containerPath" $localPath
& docker @composeArgs exec -T $Service rm -f $containerPath | Out-Null

Write-Host "Backup criado em: $localPath"
