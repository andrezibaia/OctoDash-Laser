#!/usr/bin/env python3
"""Escuta o WebSocket do OctoPrint e imprime mensagens do Better Grbl Support
(e linhas de log com WCO). Corre DENTRO do contentor de teste (usa tornado do OctoPrint).
Uso: python3 ws_probe.py <segundos> [gcode1;gcode2...]"""
import json, sys, time, urllib.request
from tornado import ioloop, websocket, gen

KEY = "ODLTESTKEY0123456789ABCDEFGHIJKL"
BASE = "http://127.0.0.1:5000"
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 5
cmds = sys.argv[2].split(";") if len(sys.argv) > 2 else []

def api(path, body=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"X-Api-Key": KEY, "Content-Type": "application/json"},
                                 method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req) as r:
        t = r.read()
        return json.loads(t) if t else None

@gen.coroutine
def main():
    login = api("/api/login", {"passive": True})
    ws = yield websocket.websocket_connect("ws://127.0.0.1:5000/sockjs/websocket")
    ws.write_message(json.dumps({"auth": f"{login['name']}:{login['session']}"}))
    end = time.time() + secs
    sent = False
    while time.time() < end:
        try:
            msg = yield gen.with_timeout(time.time() + 0.5, ws.read_message())
        except gen.TimeoutError:
            msg = None
        if msg:
            d = json.loads(msg)
            if "plugin" in d and d["plugin"]["plugin"] == "bettergrblsupport":
                print("PLUGIN", json.dumps(d["plugin"]["data"]))
            elif "current" in d:
                for l in d["current"]["logs"]:
                    if "WCO" in l or "error" in l.lower() or "ALARM" in l:
                        print("LOG", l)
                print("STATE", d["current"]["state"]["text"])
            elif "event" in d:
                print("EVENT", d["event"]["type"])
        if not sent and cmds:
            api("/api/printer/command", {"commands": cmds})
            sent = True
    ws.close()

ioloop.IOLoop.current().run_sync(main)
