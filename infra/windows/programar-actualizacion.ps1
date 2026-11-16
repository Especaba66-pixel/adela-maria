<#
  Programa que el TPV se actualice solo cada noche a las 3:30 (y, si el ordenador estaba apagado a esa hora, en cuanto
  se encienda). Solo actualiza si hay una versión nueva, hace antes una copia de seguridad y apunta lo que pasa en
  infra\windows\actualizar.log. Ejecutar una vez, en PowerShell:
      powershell -ExecutionPolicy Bypass -File C:\AdelaMaria\infra\windows\programar-actualizacion.ps1
  Para quitarlo:
      powershell -ExecutionPolicy Bypass -File C:\AdelaMaria\infra\windows\programar-actualizacion.ps1 -Quitar
#>
param([switch]$Quitar)
$ErrorActionPreference = "Stop"
$Nombre = "Adela María - Actualización"
if ($Quitar) {
  Unregister-ScheduledTask -TaskName $Nombre -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Quitada: el TPV ya no se actualiza solo." -ForegroundColor Green
  exit 0
}
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
$Accion = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\actualizar.ps1`" -Auto" -WorkingDirectory $Raiz
Register-ScheduledTask -TaskName $Nombre -Action $Accion -Trigger (New-ScheduledTaskTrigger -Daily -At "03:30") `
  -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45)) -Force | Out-Null
Write-Host "Listo: el TPV se actualizará solo cada noche a las 3:30 si hay una versión nueva." -ForegroundColor Green
Write-Host "Lo que pase queda apuntado en $Raiz\infra\windows\actualizar.log"
