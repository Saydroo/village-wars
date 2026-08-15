# botpresence-daemon.ps1 — botfull-PRÄSENZ-CONNECTOR als SESSIONFESTER Daemon.
#
# Haelt den Vollbasis-Bot "botfull" (80-Gebaeude-Kopie des emuclan-Layouts) als
# ONLINE-Verteidiger im Matchmaking. Ohne diese Praesenz findet ein Angreifer
# keinen Online-Gegner in Reichweite und bekommt nach 90s einen zufaelligen
# Ein-Gebaeude-Bot statt botfull.
#
# Laeuft — wie pg-/backend-/metro-daemon — ueber die Scheduled Task "VW_BotPresence"
# im Task-Scheduler-Dienst und ueberlebt so das Schliessen der Shell/Session. Bei
# Absturz startet die Task den Connector automatisch neu (RestartCount). Der
# Connector selbst wartet auf DB/Backend und reconnectet unbegrenzt (er ueberbrueckt
# also auch Backend-Neustarts, ohne dass der Daemon neu starten muesste).
#
# WICHTIG (Sessionfestigkeit): Anders als Backend/Metro/PG hat der Connector KEINEN
# eigenen Port, an dem sich eine stale Instanz erkennen liesse. Ein blosses
# Stop-ScheduledTask beendet aber nur die PowerShell-Huelle — die von ihr
# gestarteten npm/tsx/node-KINDER verwaisen und laufen weiter. Zwei parallele
# Connectoren (der verwaiste + der neue) koennen sich mit UNTERSCHIEDLICHEN
# Backend-Prozessen verbinden; haengt der Emulator-Angriff dann am "anderen"
# Backend, ist botfull dort NICHT online -> Ein-Gebaeude-Bot. Deshalb raeumt dieser
# Daemon seine verwaiste Prozess-Klasse (botfull_presence / "run presence") beim
# Start zuverlaessig ab, bevor er frisch startet. Selbst-Kill ist ausgeschlossen,
# weil der Cleanup VOR dem eigenen npm-Start laeuft (es existiert noch kein eigener
# presence-Prozess).
#
# Registrieren:        .\daemons-install.ps1   (VW_Postgres/VW_Backend/VW_Metro/VW_BotPresence)
# Starten/Neustarten:  .\dev-up.ps1            (startet ihn nach Backend-Health)
# Manuell neu starten: schtasks /run /tn VW_BotPresence   ·  Stoppen: schtasks /end /tn VW_BotPresence
# Status/Logs live:    Get-Content .\logs\botpresence.log -Encoding UTF8 -Wait -Tail 20

# Node in den PATH (auf dieser Maschine nicht im Shell-PATH).
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
# Gleiche DB wie Backend (der Connector holt die botfull-ID; das JWT-Secret kommt
# aus server/.env, das dotenv beim Start des Skripts laedt — cwd = server/).
$env:DATABASE_URL = 'postgresql://postgres@localhost:55432/village_wars'
Set-Location 'C:\Users\Ufuk\Claude Code\Village-Wars'

# --- Verwaiste Praesenz-Connectoren aus frueheren Runden abraeumen ---------------
# Killt alle node-Prozesse dieser Klasse (npm "run presence" -> tsx -> node
# scripts/botfull_presence.ts). So bleibt garantiert nur EIN Connector uebrig — der
# gleich frisch gestartete. Idempotent; nichts da = nichts passiert.
$stale = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'botfull_presence' -or $_.CommandLine -match 'run\s+presence') }
foreach ($p in $stale) {
  Write-Host "botpresence: raeume verwaisten Connector ab (PID $($p.ProcessId))."
  Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 1

# --- Logfile fuer Sichtbarkeit (ohne Port kann man den Status sonst nicht pruefen) -
# Der Connector loggt beim Connect "ONLINE — botfull ist jetzt als Verteidiger
# matchbar" und alle 60s einen Heartbeat. Wir leiten stdout+stderr in eine Datei,
# die pro Daemon-Start frisch beginnt (kein unbegrenztes Wachstum).
$logDir = Join-Path $PSScriptRoot 'logs'
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$log = Join-Path $logDir 'botpresence.log'
"=== VW_BotPresence Start $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Set-Content -Path $log -Encoding utf8

# Connector starten. `npm run presence -w @village-wars/server` fuehrt tsx mit
# cwd = server/ aus -> dotenv laedt server/.env (gleiches JWT_ACCESS_SECRET wie das
# Backend, damit botfulls Token akzeptiert wird). Blockiert bewusst (Socket +
# Heartbeat) -> die Task bleibt "Running". Ausgabe zusaetzlich ins Logfile.
#
# Redirect via cmd: PowerShells `*>>` schreibt UTF-16 (Null-Bytes -> Select-String
# und `-Wait`-Tailing unbrauchbar). cmd haengt node's UTF-8-stdout/stderr 1:1 an und
# blockiert -> die Task bleibt "Running". Lesen mit: Get-Content ... -Encoding UTF8.
cmd /c "npm run presence -w @village-wars/server >> `"$log`" 2>&1"
