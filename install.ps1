# Compatibility entry point. This version never patches a DSH engine.
param([string]$ToolBin, [switch]$SkipDownload, [switch]$SkipHttpsCheck)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'setup.ps1') @PSBoundParameters
