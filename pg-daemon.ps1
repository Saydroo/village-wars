# pg-daemon.ps1 — portable PostgreSQL-Test-DB (:55432) als SESSIONFESTER Daemon.
#
# Analog zu metro-/backend-daemon: laeuft ueber die Scheduled Task "VW_Postgres"
# im Task-Scheduler-Dienst, damit die Test-DB das Schliessen der Shell/Session
# ueberlebt. Sonst faellt die DB weg -> Backend-health services.database = down
# -> App kommt nicht ins Dorf. Bei Absturz startet die Task PG automatisch neu.
#
# postgres.exe DIREKT (kein pg_ctl-Wrapper): pg_ctl haengt in nicht-interaktiven
# Kontexten; direkt ist robust und blockiert -> die Task bleibt "Running".

$pgbin  = 'C:\Users\Ufuk\vw_pgtest\pgsql\bin'
$pgdata = 'C:\Users\Ufuk\vw_pgtest\data'

# Stale PG auf 55432 idempotent raeumen (falls von frueherem Start uebrig).
$c = Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue
if ($c) { $c.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Start-Sleep -Seconds 2 }
if (Test-Path "$pgdata\postmaster.pid") { Remove-Item "$pgdata\postmaster.pid" -Force -ErrorAction SilentlyContinue }

# Postmaster im Vordergrund (blockiert -> Task laeuft, Auto-Restart bei Absturz).
& "$pgbin\postgres.exe" -D $pgdata -p 55432
