#!/bin/bash
# Liga o OctoPrint de teste ao grbl-sim e contorna um artefacto do simulador:
# o BGS envia um soft-reset (0x18) na sequência de ligação e o grbl-sim perde a
# resposta ao "$#"; o BGS fica à espera dela e suspende a interrogação de estado.
# Um "$#" extra, depois de ligado, desbloqueia-o.
K=ODLTESTKEY0123456789ABCDEFGHIJKL
U=http://127.0.0.1:5080
H=(-H "X-Api-Key: $K" -H "Content-Type: application/json")
# Só no teste: o BGS põe "M999" (reset) no afterPrinterConnected, que corre em simultâneo
# com as perguntas iniciais do plugin ($I/$G/$#) e as apaga no grbl-sim. Ver LEIA-ME.
docker exec odl-octoprint sh -c ': > /data/scripts/gcode/afterPrinterConnected' 2>/dev/null || true
curl -s "${H[@]}" -X POST $U/api/connection -d '{"command":"connect","port":"/tmp/ttyGRBL","baudrate":115200,"printerProfile":"_bgs"}'
for i in $(seq 1 30); do
  st=$(curl -s "${H[@]}" $U/api/connection | python3 -c "import sys,json;print(json.load(sys.stdin)['current']['state'])")
  [ "$st" = "Operational" ] && break
  sleep 1
done
sleep 3
curl -s "${H[@]}" -X POST $U/api/printer/command -d '{"commands":["$130=300","$131=200","$32=1","$110=6000","$111=6000","$120=500","$121=500","$30=1000"]}'
echo "estado: $st"
