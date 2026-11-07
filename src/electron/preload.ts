// Runs in the sandboxed preload: the only thing the page can reach is `window.fm`.
import { contextBridge, ipcRenderer } from "electron";
import type { FmApi } from "./api.ts";

const fm: FmApi = {
  owner: {
    read: () => ipcRenderer.invoke("owner:read"),
    write: (text) => ipcRenderer.invoke("owner:write", text),
    writeSync: (text) => { ipcRenderer.sendSync("owner:writeSync", text); },
    openFolder: () => ipcRenderer.invoke("owner:openFolder"),
    backupAndReset: () => ipcRenderer.invoke("owner:backupAndReset"),
  },
  snapshot: { read: () => ipcRenderer.invoke("snapshot:read") },
  importer: {
    pickSave: () => ipcRenderer.invoke("importer:pickSave"),
    start: (savePath) => ipcRenderer.invoke("importer:start", savePath),
    cancel: () => ipcRenderer.invoke("importer:cancel"),
    onProgress(cb) {
      const h = (_e: unknown, percent: number, message: string) => cb(percent, message);
      ipcRenderer.on("importer:progress", h);
      return () => { ipcRenderer.removeListener("importer:progress", h); };
    },
  },
  lifecycle: {
    onBeforeClose(cb) {
      const h = () => cb();
      ipcRenderer.on("app:before-close", h);
      return () => { ipcRenderer.removeListener("app:before-close", h); };
    },
    ack: () => { ipcRenderer.send("app:flushed"); },
  },
};
contextBridge.exposeInMainWorld("fm", fm);
