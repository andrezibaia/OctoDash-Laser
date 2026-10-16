#!/bin/bash
# Arranque do ambiente de teste: grbl-sim numa porta série virtual + OctoPrint.
set -e
BASE=/data
mkdir -p "$BASE"
if [ ! -f "$BASE/config.yaml" ]; then
  cp /seed/config.yaml "$BASE/config.yaml"
fi

if [ ! -f "$BASE/users.yaml" ] || ! grep -q apikey "$BASE/users.yaml"; then
  octoprint --basedir "$BASE" user add --password test --admin test >/dev/null 2>&1 || true
  python3 - <<'PY'
import yaml
p = "/data/users.yaml"
u = yaml.safe_load(open(p)) or {}
u["test"]["apikey"] = "ODLTESTKEY0123456789ABCDEFGHIJKL"
yaml.safe_dump(u, open(p, "w"))
PY
fi

# grbl-sim atrás de uma pty; reinicia se a simulação terminar (ex.: soft reset)
(
  while true; do
    socat PTY,link=/tmp/ttyGRBL,raw,echo=0,mode=666 \
      EXEC:"python3 /relay.py",pty,raw,echo=0 2>>/tmp/socat.log
    sleep 0.5
  done
) &

for i in $(seq 1 20); do [ -e /tmp/ttyGRBL ] && break; sleep 0.2; done
exec octoprint --basedir "$BASE" serve --iknowwhatimdoing --host 0.0.0.0 --port 5000
