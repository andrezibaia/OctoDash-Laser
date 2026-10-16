import { Injectable } from '@angular/core';
import { IpcRenderer } from 'electron';

import { NotificationService } from './notification.service';

type Listener = (...args) => void;

/**
 * Minimal stand-in for Electron's IPC when OctoDash-Laser runs in a plain browser
 * (development and automated UI tests). Config is kept in localStorage and is
 * never validated against the schema — the Electron build still does that.
 */
class BrowserIpcShim {
  private static readonly STORAGE_KEY = 'octodash-laser-config';
  private listeners = new Map<string, Listener[]>();

  public on(channel: string, listener: Listener): void {
    this.listeners.set(channel, [...(this.listeners.get(channel) ?? []), listener]);
  }

  public removeListener(channel: string, listener: Listener): void {
    this.listeners.set(
      channel,
      (this.listeners.get(channel) ?? []).filter(l => l !== listener),
    );
  }

  public send(channel: string, ...args): void {
    switch (channel) {
      case 'readConfig': {
        const raw = localStorage.getItem(BrowserIpcShim.STORAGE_KEY);
        this.emit('configRead', raw ? JSON.parse(raw) : undefined);
        break;
      }
      case 'checkConfig':
        this.emit('configPass');
        break;
      case 'saveConfig':
        localStorage.setItem(BrowserIpcShim.STORAGE_KEY, JSON.stringify(args[0]));
        this.emit('configSaved', args[0]);
        break;
      case 'resetConfig':
        localStorage.removeItem(BrowserIpcShim.STORAGE_KEY);
        this.emit('configErased');
        break;
      case 'reload':
        window.location.reload();
        break;
      default:
        break;
    }
  }

  private emit(channel: string, ...args): void {
    setTimeout(() => (this.listeners.get(channel) ?? []).forEach(listener => listener({}, ...args)), 0);
  }
}

@Injectable({
  providedIn: 'root',
})
export class ElectronService {
  private ipcRenderer: IpcRenderer | BrowserIpcShim | undefined;

  constructor(private notificationService: NotificationService) {
    if (window.require) {
      this.ipcRenderer = window.require('electron').ipcRenderer;
    } else if (window.location.protocol.startsWith('http')) {
      console.warn('OctoDash-Laser: Electron not available, using browser shim (development mode).');
      this.ipcRenderer = new BrowserIpcShim();
    } else {
      this.notificationService.error(
        "Can't load electron library",
        'Please restart your system and open a new issue on GitHub if this issue persists.',
        true,
      );
    }
  }

  public on(channel: string, listener: (...args) => void): void {
    if (!this.ipcRenderer) {
      return;
    }
    this.ipcRenderer.on(channel, listener);
  }

  public removeListener(channel: string, listener: (...args) => void): void {
    if (!this.ipcRenderer) {
      return;
    }
    this.ipcRenderer.removeListener(channel, listener);
  }

  public send(channel: string, ...args): void {
    if (!this.ipcRenderer) {
      return;
    }
    this.ipcRenderer.send(channel, ...args);
  }
}
