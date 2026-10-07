param([string]$Profile = 'web')
# Removing the bundle restores the official provider on the next launch.
# Keep downloaded files and historical engine backups: they may be shared.
Write-Host "Stop DSH, then run:"
Write-Host "  npx @deepseek-ai/dsh plugin --profile $Profile remove @ctfyui/dsh-plugin-net-access"
Write-Host "Restart DSH. Toolbox files are retained. See README for legacy migration."
