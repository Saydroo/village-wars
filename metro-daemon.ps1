# metro-daemon.ps1 — Metro (Expo Dev-Server) als SESSIONFESTER Daemon.
#
# Wird von der Windows-Scheduled-Task "VW_Metro" ausgefuehrt. Dadurch laeuft Metro
# im Task-Scheduler-Dienst statt im Prozessbaum der aufrufenden Shell/Session —
# es ueberlebt das Schliessen der Shell/Session und den roten
# "Unable to load script"-Screen gibt es dann nicht mehr, weil Metro stabil
# weiterlaeuft. Bei Absturz startet die Task es automatisch neu (RestartCount).
#
# Registrieren:        .\daemons-install.ps1   (VW_Metro + VW_Backend)
# Starten/Neustarten:  .\dev-up.ps1            (Daemons frisch + reverse)
# Manuell neu starten: schtasks /run /tn VW_Metro     ·  Stoppen: schtasks /end /tn VW_Metro

# Node in den PATH (auf dieser Maschine nicht im Shell-PATH).
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
Set-Location 'C:\Users\Ufuk\Claude Code\Village-Wars\apps\mobile'

# Stale Metro auf 8081 idempotent raeumen, damit der frische binden kann.
$c = Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue
if ($c) { $c.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }

# Wie beim Backend: verwaiste expo/Metro-PARENTS aus einer per Stop-ScheduledTask
# beendeten Vorrunde respawnen sonst einen neuen Metro und konkurrieren um 8081.
# Ganze Metro-Prozess-Klasse abraeumen (laeuft VOR dem eigenen Start -> kein Selbst-Kill).
$stale = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -match 'expo' -and ($_.CommandLine -match 'start' -or $_.CommandLine -match '8081') }
foreach ($p in $stale) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 1

# Metro FRISCH mit Cache-Reset (-c) starten. Blockiert bewusst -> die Task bleibt
# "Running", solange Metro laeuft. Der Cache-Reset umgeht die Windows-Watcher-Falle
# (externe Edits werden sonst nicht erkannt -> alter Bundle-Stand).
npx expo start --dev-client --port 8081 -c
