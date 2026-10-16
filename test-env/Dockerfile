# Ambiente de teste do OctoDash-Laser:
# OctoPrint + Better Grbl Support + grbl-sim (firmware GRBL 1.1 real a correr no PC)
# ligado por uma porta série virtual (socat).
FROM python:3.12-slim-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git socat curl ca-certificates procps \
    && rm -rf /var/lib/apt/lists/*

# --- grbl-sim ---
WORKDIR /opt
RUN git clone --depth 1 --branch v1.1h.20190825 https://github.com/gnea/grbl.git \
    && cd grbl/grbl && git clone --depth 1 https://github.com/grbl/grbl-sim.git grbl-sim
WORKDIR /opt/grbl/grbl/grbl-sim
RUN sed -i "s|//setvbuf(stdout|setvbuf(stdout|" main.c && sed -i "s/^COMPILE *= *\$(CC)/COMPILE = \$(CC) -fcommon/" Makefile && grep -n "^COMPILE\|^CC\|LIBS\|FLAGS" Makefile && (make new > /tmp/m.log 2>&1 || (grep -iE "error|multiple|undefined" /tmp/m.log | head; exit 1)) && ls *.exe

# --- OctoPrint + Better Grbl Support ---
RUN pip install --no-cache-dir "OctoPrint>=1.10" \
    && pip install --no-cache-dir "https://github.com/synman/Octoprint-Bettergrblsupport/archive/master.zip"

COPY start.sh /start.sh
COPY relay.py /relay.py
COPY config.yaml /seed/config.yaml
RUN chmod +x /start.sh
EXPOSE 5000
CMD ["/start.sh"]
