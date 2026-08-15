# daemons-install.ps1 — registriert die SESSIONFESTEN Scheduled Tasks für die
# Dev-Server und startet sie NICHT (das macht dev-up.ps1). Idempotent (-Force).
#
#   VW_Postgres    -> pg-daemon.ps1          (:55432, Test-DB)
#   VW_Backend     -> backend-daemon.ps1     (:4000)
#   VW_Metro       -> metro-daemon.ps1       (:8081, Expo mit -c)
#   VW_BotPresence -> botpresence-daemon.ps1 (haelt "botfull" online als Verteidiger)
#
# Alle laufen im Task-Scheduler-Dienst (User-Kontext, "nur wenn angemeldet" →
# Node/PATH verfügbar), überleben so Shell/Session, und starten bei Absturz neu.
#
#   .\daemons-install.ps1
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$defs = @(
  @{ Name = 'VW_Postgres';    Script = 'pg-daemon.ps1';          Desc = 'Village Wars PostgreSQL Test-DB (:55432) — sessionfester Daemon' },
  @{ Name = 'VW_Backend';     Script = 'backend-daemon.ps1';     Desc = 'Village Wars Backend (:4000) — sessionfester Daemon' },
  @{ Name = 'VW_Metro';       Script = 'metro-daemon.ps1';       Desc = 'Village Wars Metro (Expo Dev-Server, :8081) — sessionfester Daemon' },
  @{ Name = 'VW_BotPresence'; Script = 'botpresence-daemon.ps1'; Desc = 'Village Wars botfull-Praesenz-Connector (Online-Verteidiger im Matchmaking) — sessionfester Daemon' }
)
# Hinweis: KEIN "At-LogOn"-Trigger — der braucht (fuer "alle Benutzer") Admin und
# wirft sonst "Zugriff verweigert". Die Daemons ueberleben die Shell/Session
# (Task-Scheduler-Dienst) auch ohne Trigger; nach Logoff/Reboot startet sie
# dev-up.ps1 wieder (der Sitzungs-Start-Befehl).
foreach ($d in $defs) {
  $file = Join-Path $root $d.Script
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$file`""
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable
  $task = New-ScheduledTask -Action $action -Settings $settings -Description $d.Desc
  # -Force ueberschreibt nur, wenn registrierbar; existierende laufende Tasks bleiben sonst.
  try { Register-ScheduledTask -TaskName $d.Name -InputObject $task -Force -ErrorAction Stop | Out-Null; Write-Host "  $($d.Name) registriert." }
  catch { Write-Host "  $($d.Name): bereits registriert (behalte bestehende Definition)." }
}
Write-Host 'Daemons registriert. Start/Neustart über dev-up.ps1.'
