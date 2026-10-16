# OctoDash-Laser

Fork do [OctoDash](https://github.com/UnchartedBull/OctoDash) 2.8.0 (Apache-2.0) para o ecrã tátil
de 7" (800×480) ao lado do laser K40. Fala com o OctoPrint + **Better Grbl Support** (o OctoPrint é
o dono da porta série; o RayForge continua a enviar trabalhos pelo driver OctoPrint).

## Ecrãs (v1 = F1–F8 + câmara)

| Rota           | Ecrã             | O que faz                                                                                                                                                                                    |
| -------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/main-screen` | Início           | Estado GRBL, mapa da mesa 300×200 com cabeça/origem/trabalho, posição; um toque troca para a **câmara ao vivo** (go2rtc). Alarme / porta / sem ligação aparecem no lugar do botão principal. |
| `/jog`         | Mover            | Cruz com diagonais; passo 0.1/1/10/50 mm **ou contínuo (∞)**; Origem aqui; Home; Desbloquear; Disparo de teste (manter premido).                                                             |
| `/jobs`        | Trabalhos        | Ficheiros do OctoPrint (recentes primeiro), traçado lido do G-code, tamanho/tempo/potência, aviso se sai da mesa, Enquadrar.                                                                 |
| `/prepare`     | Antes de começar | Lista de verificação (máquina, área, enquadramento, itens manuais configuráveis) — **só avisa**, não bloqueia; deslizar para iniciar.                                                        |
| `/job`         | A trabalhar      | Progresso desenhado no traçado, %, falta/decorrido, Pausa (um toque), Parar (manter 1 s). Abre sozinho quando um trabalho começa (também se vier do RayForge).                               |
| `/camera`      | Câmara           | Imagem ao vivo + Mover / Origem aqui.                                                                                                                                                        |
| `/more`        | Mais             | Ir à origem, Desbloquear, Definições, botões personalizados, recarregar, reiniciar OctoPrint, desligar (duplo toque).                                                                        |
| `/settings`    | Definições       | Máquina, Movimento, Laser, Câmara, Ecrã (idioma PT/EN), Ligação, Sobre — só opções do laser, números com botões ±.                                                                           |

Configuração nova em `laser` (ver `src/helper/config.schema.json`): `bed` (300×200, origem, eixo Y),
`jog` (velocidade mm/min, passos, máximo contínuo), `testFire` (% e ms), `maxPower` ($30),
`rapidFeed`, `camera.url`, `checklist` (itens manuais), `language` (`pt`/`en`).

## Decisões técnicas importantes

- **Jog contínuo** = segmentos `$J` curtos (~0,3 s de percurso), só se envia o seguinte quando falta
  menos de um segmento; ao largar envia `M5 <0x85> S0` (cancelamento de jog GRBL embutido numa linha
  normal — o OctoPrint descarta linhas só com 0x85 e o BGS reescreve linhas começadas por `?`).
  Mesmo sem cancelamento a cabeça para no fim do segmento. Limitado à mesa quando a posição é conhecida.
- **Nunca enviar `$I`, `$#`, `$G`, `$$` a partir da app**: o BGS associa respostas a pedidos por
  ordem; um pedido extra dessincroniza-o, ele deixa de pedir o estado (`?`) e o OctoPrint dá a placa
  por morta ao fim de ~90 s.
- Posição de trabalho: WCO lido das linhas de estado no log do OctoPrint (o BGS não o reencaminha).
- Pausa: o OctoPrint só pausa quando a placa confirma a linha em curso → o ecrã mostra
  "A pausar… termina o movimento atual" até passar a "Em pausa".

## Compilar

```bash
docker run --rm -v "$PWD:/app" -w /app -e HOME=/tmp -u $(id -u):$(id -g) node:22-bookworm \
  bash -c "npm ci && npm run lint && npx ng build --configuration production && \
           npx electron-builder build -l deb --arm64 --armv7l"
```

Pacotes em `package/` (`octodash-laser_<versão>_arm64.deb`, `_armv7l.deb`). Instala em
`/opt/OctoDash-Laser/octodash-laser`; config em `~/.config/octodash-laser/config.json`.

## Testar sem a máquina

`test-env/` tem OctoPrint 1.11 + Better Grbl Support + grbl-sim (GRBL 1.1h) num contentor:

```bash
cd test-env && docker build -t odl-testenv . && \
docker run -d --name odl-octoprint -p 127.0.0.1:5080:5000 odl-testenv && sleep 60 && ./connect.sh
```

API key de teste em `test-env/connect.sh`. Para abrir a app num browser, servir `dist/en`
(o modo browser guarda a config em `localStorage`). `connect.sh` esvazia o `afterPrinterConnected`
(ver nota abaixo); `relay.py` dá ao simulador tempo para responder antes/depois de um reset.

## A confirmar na máquina real

- O BGS escreve `M999` (= reset 0x18) no script `afterPrinterConnected`, que corre ao mesmo tempo que
  as perguntas iniciais do plugin (`$I $G $#`). No simulador isto apaga as respostas e a ligação morre
  ao fim de ~90 s. Na placa real pode não acontecer (é mais rápida) — se o OctoPrint perder a placa
  ~1,5 min depois de ligar, esvaziar esse script resolve.
- Velocidade de jog (`laser.jog.feed`, 600 mm/min por omissão) e aceleração ($120/$121).
- Disparo de teste: potência/duração em `laser.testFire`; `maxPower` tem de igualar o `$30` da placa.
