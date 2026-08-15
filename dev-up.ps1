# dev-up.ps1 - Idempotenter Start der Village-Wars-Dev-Umgebung (ein Befehl).
#
# Reihenfolge:
#   1. PostgreSQL (55432) pruefen/starten, auf ready warten
#   2. Sessionfeste Daemons registrieren (VW_Backend :4000, VW_Metro :8081) und
#      FRISCH neu starten. Sie laufen im Task-Scheduler-Dienst -> ueberleben das
#      Schliessen der Shell/Session (kein roter "Unable to load script"-Screen
#      mehr) und starten bei Absturz automatisch neu. Metro startet mit -c
#      (Cache-Reset gegen die Windows-Watcher-Falle: externe Edits werden sonst
#      nicht erkannt -> alter Bundle-Stand am Geraet).
#   3. Auf Backend-health (services.database=up) + Metro (:8081) warten
#   3b. VW_BotPresence frisch starten (haelt "botfull" online als Verteidiger, damit
#       ein Angriff botfull statt eines zufaelligen Ein-Gebaeude-Bots matcht). Bewusst
#       NACH Backend-Health: botfull soll seine Trophaeen aus der ready-DB laden.
#   4. adb reverse tcp:8081 + tcp:4000 setzen
#
# Idempotent: mehrfach aufrufbar. Die Daemons raeumen ihren Port beim Start selbst.
#
# Aufruf:  .\dev-up.ps1
$ErrorActionPreference = 'Continue'

# Node in den PATH holen (auf dieser Maschine nicht im Shell-PATH).
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

$repo   = $PSScriptRoot
$adb    = 'C:\Users\Ufuk\AppData\Local\Android\Sdk\platform-tools\adb.exe'
$pgbin  = 'C:\Users\Ufuk\vw_pgtest\pgsql\bin'
$pgdata = 'C:\Users\Ufuk\vw_pgtest\data'

function Log($m) { Write-Host "[dev-up] $m" -ForegroundColor Cyan }
function Test-Port($port) { return [bool](Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue -InformationLevel Quiet) }
function Wait-Port($port, $timeoutSec) { for ($i=0; $i -lt $timeoutSec; $i++) { if (Test-Port $port) { return $true }; Start-Sleep -Seconds 1 }; return $false }
function Backend-DbUp() { try { $h = Invoke-RestMethod -Uri 'http://localhost:4000/api/health' -TimeoutSec 3; return ($h.services.database -eq 'up') } catch { return $false } }

# --- 1. Daemons registrieren + PostgreSQL (VW_Postgres) zuerst frisch starten ---
#        (Backend haengt an PG -> PG muss ready sein, bevor das Backend startet.)
Log '1/4  Daemons registrieren + PostgreSQL (VW_Postgres) ...'
& (Join-Path $repo 'daemons-install.ps1') | Out-Null
try { Stop-ScheduledTask -TaskName 'VW_Postgres' -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'VW_Postgres'
$pgok = $false
for ($i=0; $i -lt 30; $i++) { Start-Sleep -Seconds 1; if ("$(& "$pgbin\pg_isready.exe" -h localhost -p 55432 2>&1)" -match 'accepting|angenommen') { $pgok = $true; break } }
Log "     PostgreSQL ready = $pgok"

# --- 2. Backend + Metro (Daemons) FRISCH neu starten ---
Log '2/4  VW_Backend (:4000) + VW_Metro (:8081, -c) frisch neu starten ...'
foreach ($t in 'VW_Backend', 'VW_Metro') { try { Stop-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue } catch {} }
Start-Sleep -Seconds 1
foreach ($t in 'VW_Backend', 'VW_Metro') { Start-ScheduledTask -TaskName $t; Log "     $t (neu) gestartet." }

# --- 3. Auf Backend-health + Metro warten ---
Log '3/4  Warte auf Backend (:4000 health) + Metro (:8081) ...'
$up = $false
for ($i=0; $i -lt 45; $i++) { Start-Sleep -Seconds 1; if (Backend-DbUp) { $up = $true; break } }
if ($up) { Log '     Backend services.database = up.' } else { Log '     WARN: Backend nicht database:up (VW_Backend / PG pruefen).' }
if (Wait-Port 8081 60) { Log '     Metro :8081 bereit (Cache frisch).' } else { Log '     WARN: Metro 8081 kam nicht hoch (VW_Metro pruefen).' }

# --- 3b. VW_BotPresence (haelt "botfull" online als Verteidiger) frisch starten ---
#         Nach Backend-Health, damit botfull seine Trophaeen aus der ready-DB liest.
Log '3b/4 VW_BotPresence (botfull online halten) frisch neu starten ...'
try { Stop-ScheduledTask -TaskName 'VW_BotPresence' -ErrorAction SilentlyContinue } catch {}
Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName 'VW_BotPresence'
Log '     VW_BotPresence (neu) gestartet — botfull verbindet sich als Online-Verteidiger.'

# --- 4. adb reverse 8081 + 4000 ---
Log '4/4  adb reverse ...'
$dev = (& $adb devices) -join "`n"
if ($dev -match 'device\b') {
  & $adb reverse tcp:8081 tcp:8081 | Out-Null
  & $adb reverse tcp:4000 tcp:4000 | Out-Null
  Log '     tcp:8081 + tcp:4000 gesetzt.'
} else {
  Log '     WARN: kein Emulator/Geraet verbunden - reverse uebersprungen (Emulator starten, dann erneut ausfuehren).'
}

Log 'FERTIG. App neu laden: adb shell am force-stop com.villagewars.app  +  adb shell monkey -p com.villagewars.app -c android.intent.category.LAUNCHER 1'
