import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  onCommands: (callback: (commands: unknown) => void) => {
    ipcRenderer.on("update-commands", (_event, commands) => callback(commands));
  },
  onHideTooltip: (callback: () => void) => {
    ipcRenderer.on("hide-tooltip", () => callback());
  },
});
