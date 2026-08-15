# backend-daemon.ps1 — Village Wars Backend (:4000) als SESSIONFESTER Daemon.
#
# Analog zu metro-daemon.ps1: laeuft ueber die Scheduled Task "VW_Backend" im
# Task-Scheduler-Dienst, damit das Backend (wie Metro) das Schliessen der
# Shell/Session ueberlebt. Ohne das erreicht die App das Backend nicht mehr
# ("Verbindung fehlgeschlagen / Network Error") und man kommt nicht ins Dorf.
# Bei Absturz startet die Task es automatisch neu.

$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
$env:DATABASE_URL = 'postgresql://postgres@localhost:55432/village_wars'
Set-Location 'C:\Users\Ufuk\Claude Code\Village-Wars'

# Stale Backend auf 4000 idempotent raeumen (der eigentliche Server = Port-Halter).
$c = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue
if ($c) { $c.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }

# WICHTIG: Der Port-Kill trifft nur das Server-Kind. Der VERWAISTE tsx-watch-PARENT
# (aus einer per Stop-ScheduledTask beendeten Vorrunde — die Huelle stirbt, die
# npm/tsx-Kinder verwaisen) haelt keinen Port, RESPAWNT aber sofort ein neues
# Server-Kind -> zwei konkurrierende Backends grabben abwechselnd Port 4000. Jeder
# Wechsel verliert die in-memory Online-Map (botfull faellt raus). Deshalb hier die
# ganze Backend-Prozess-Klasse abraeumen. Selbst-Kill ausgeschlossen: laeuft VOR dem
# eigenen npm-Start.
$stale = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'watch\s+src/index\.ts' -or $_.CommandLine -match 'run\s+dev:server' -or $_.CommandLine -match 'run\s+dev\s+-w\s+@village-wars/server') }
foreach ($p in $stale) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# Backend starten (tsx watch, blockiert -> Task bleibt "Running").
npm run dev:server
