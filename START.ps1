# PPIC - One Click Launcher (PowerShell)
# Right-click and select "Run with PowerShell" to start

$scriptPath = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Set-Location $scriptPath

# Run setup.bat
& .\setup.bat
