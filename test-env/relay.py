#!/usr/bin/env python3
"""Relay between the virtual serial port (socat) and grbl-sim, for the test environment only.

grbl-sim takes noticeably longer than a real board to restart after a soft reset (0x18), so
lines sent right after a reset are lost and Better Grbl Support's request tracking stalls.
This relay forwards everything unchanged but lets the sim answer earlier lines before a 0x18
and pauses 300 ms after it, like a real board that answers and resets within milliseconds.
"""
import os
import pty
import select
import sys
import time
import tty

SIM = ["/opt/grbl/grbl/grbl-sim/grbl_sim.exe", "-n", "-s", "/dev/null", "-b", "/dev/null"]

pid, fd = pty.fork()
if pid == 0:
    os.execv(SIM[0], SIM)

tty.setraw(fd)
stdin = sys.stdin.fileno()
stdout = sys.stdout.fileno()
pending = b""

while True:
    try:
        readable, _, _ = select.select([stdin, fd], [], [], 0.05)
    except InterruptedError:
        continue
    if stdin in readable:
        data = os.read(stdin, 4096)
        if not data:
            break
        pending += data
    if fd in readable:
        try:
            data = os.read(fd, 4096)
        except OSError:
            break
        if not data:
            break
        os.write(stdout, data)
    # forward host → sim, holding back after each reset byte
    while pending:
        idx = pending.find(b"\x18")
        if idx < 0:
            os.write(fd, pending)
            pending = b""
            break
        os.write(fd, pending[:idx])
        # let the sim finish the lines already sent (a real board answers them in a few ms)
        time.sleep(0.5)
        drain_until = time.time() + 0.1
        while time.time() < drain_until:
            r, _, _ = select.select([fd], [], [], 0.02)
            if r:
                os.write(stdout, os.read(fd, 4096))
        os.write(fd, b"\x18")
        pending = pending[idx + 1 :]
        time.sleep(0.3)
