param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$ComposeFile = "docker-compose.yml",
  [string]$EnvFile = "",
  [string]$Service = "postgres",
  [string]$Database = "",
  [string]$User = "",
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $BackupFile)) {
  throw "Arquivo de backup nao encontrado: $BackupFile"
}

if (-not $Yes) {
  Write-Host "ATENCAO: a restauracao apaga/substitui objetos existentes no banco de destino."
  $confirmation = Read-Host "Digite RESTAURAR para continuar"
  if ($confirmation -ne "RESTAURAR") {
    throw "Restauracao cancelada."
  }
}

$composeArgs = @("compose")
if ($EnvFile) {
  $composeArgs += @("--env-file", $EnvFile)
}
$composeArgs += @("-f", $ComposeFile)

$containerId = (& docker @composeArgs ps -q $Service).Trim()
if (-not $containerId) {
  throw "Container do servico '$Service' nao encontrado. Suba o banco antes de restaurar."
}

$fileName = Split-Path -Path $BackupFile -Leaf
$containerPath = "/tmp/$fileName"

& docker cp $BackupFile "${containerId}:$containerPath"

$dbArg = if ($Database) { $Database } else { '${POSTGRES_DB}' }
$userArg = if ($User) { $User } else { '${POSTGRES_USER}' }
$restoreCommand = "pg_restore -U `"$userArg`" -d `"$dbArg`" --clean --if-exists --no-owner --no-privileges `"$containerPath`""

& docker @composeArgs exec -T $Service sh -lc $restoreCommand
& docker @composeArgs exec -T $Service rm -f $containerPath | Out-Null

Write-Host "Backup restaurado com sucesso em: $BackupFile"
