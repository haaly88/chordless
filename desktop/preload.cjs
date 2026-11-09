const { contextBridge, ipcRenderer } = require('electron');

// Desktop-only bridge. In the browser build window.chordless is undefined
// and the UI hides desktop-only settings instead.
contextBridge.exposeInMainWorld('chordless', {
  isDesktop: true,
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),
  setUiScale: (scale) => ipcRenderer.invoke('ui:scale', scale),
  quit: () => ipcRenderer.invoke('app:quit'),
  show: () => ipcRenderer.invoke('app:show'),
  onTrayCommand: (handler) =>
    ipcRenderer.on('chordless:tray', (_e, command) => handler(command)),
});
