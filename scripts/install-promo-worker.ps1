param([switch]$Run)
$ErrorActionPreference='Stop'
$promoRoot=Split-Path $PSScriptRoot -Parent
$nodeExecutable=(Get-Command node).Source
if($Run){
 Set-Location -LiteralPath $promoRoot
 $env:NODE_PATH=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
 & $nodeExecutable (Join-Path $PSScriptRoot 'promo-worker.cjs')
 exit $LASTEXITCODE
}
$taskName='GayRetroTCG-CardPromoWorker'
$scriptFile=Join-Path $PSScriptRoot 'install-promo-worker.ps1'
$existing=Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if($existing -and ($existing.Actions.Arguments -notlike "*$scriptFile*")){throw 'A different task already uses this name.'}
$action=New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -NonInteractive -WindowStyle Hidden -File `"$scriptFile`" -Run" -WorkingDirectory $promoRoot
$trigger=New-ScheduledTaskTrigger -AtLogOn -User ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
$principal=New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settings=New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force|Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output 'Shop PC worker installed and started. It runs while signed in and the PC is awake.'
