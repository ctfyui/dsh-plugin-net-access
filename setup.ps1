param(
    [string]$ToolBin,
    [switch]$SkipDownload,
    [switch]$SkipHttpsCheck
)
$ErrorActionPreference = 'Stop'
$setupArgs = @((Join-Path $PSScriptRoot 'scripts\setup.mjs'))
if ($ToolBin) { $setupArgs += @('--tool-bin', $ToolBin) }
if ($SkipDownload) { $setupArgs += '--skip-download' }
if ($SkipHttpsCheck) { $setupArgs += '--skip-https-check' }
& node @setupArgs
if ($LASTEXITCODE -ne 0) { throw "Net Access setup failed (exit $LASTEXITCODE)." }
