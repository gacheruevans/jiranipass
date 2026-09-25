const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jiranipassDesktop', {
  platform: process.platform,
  isDesktop: true,
  notify: (title, body) => ipcRenderer.send('show-notification', { title, body }),
});
