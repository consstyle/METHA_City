<#
.SYNOPSIS
  Empaqueta el código del commit actual en un zip para subirlo a Dokploy («Drop», F5b/D23).

.DESCRIPTION
  Usa `git archive`: solo entra lo que está en el commit (nada de node_modules, builds, .env ni
  datos locales). Exige el árbol limpio para que el zip sea exactamente un commit conocido.
  No sube nada a ningún sitio: deja el zip en dist/ y muestra su huella SHA-256.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts/package-demo.ps1
#>
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)

$dirty = git status --porcelain
if ($dirty) {
  Write-Error "Hay cambios sin commit. Haz commit (o descártalos) antes de empaquetar:`n$dirty"
}

$sha = (git rev-parse --short HEAD).Trim()
New-Item -ItemType Directory -Force dist | Out-Null
$zip = Join-Path (Resolve-Path dist) "methacity-demo-$sha.zip"
git archive --format=zip --output="$zip" HEAD
if ($LASTEXITCODE -ne 0) { Write-Error 'git archive falló' }

$hash = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
$size = [math]::Round((Get-Item $zip).Length / 1MB, 2)
Write-Output "Paquete: $zip"
Write-Output "Commit:  $sha"
Write-Output "Tamaño:  $size MB"
Write-Output "SHA-256: $hash"
