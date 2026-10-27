<#
  Deja la tarea «Adela María - App» como la crea ahora el instalador: arranca al iniciar sesión y, además, se comprueba
  cada 5 minutos (si se ha parado, se vuelve a lanzar). Para instalaciones anteriores; ejecutar una vez, en PowerShell
  como administrador:
      powershell -ExecutionPolicy Bypass -File C:\AdelaMaria\infra\windows\vigilar-app.ps1
#>
$ErrorActionPreference = "Stop"
$Raiz = (Resolve-Path "$PSScriptRoot\..\..").Path
$Usuario = "$env:USERDOMAIN\$env:USERNAME"
$Arrancar = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Raiz\infra\windows\arrancar.ps1`"" -WorkingDirectory $Raiz
$Vigilar = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName "Adela María - App" -Action $Arrancar -Trigger @((New-ScheduledTaskTrigger -AtLogOn -User $Usuario), $Vigilar) `
  -Settings (New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit 0 `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -DontStopOnIdleEnd) -Force | Out-Null
Start-ScheduledTask -TaskName "Adela María - App"
Write-Host "Listo: la app se comprueba cada 5 minutos y se vuelve a encender si se ha parado." -ForegroundColor Green
