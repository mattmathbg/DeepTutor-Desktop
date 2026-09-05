const { contextBridge, ipcRenderer, shell } = require('electron');

contextBridge.exposeInMainWorld('deeptutorAPI', {
  // Écoute des mises à jour de statut du cycle de vie Docker
  onStatusChange: (callback) => {
    ipcRenderer.on('docker:status', (_event, data) => callback(data));
  },

  // Écoute des flux de logs bruts (stdout / stderr)
  onLogMessage: (callback) => {
    ipcRenderer.on('docker:log', (_event, data) => callback(data));
  },

  // Relance de la séquence de démarrage (en cas d'erreur)
  retryStartup: () => {
    ipcRenderer.send('app:retry');
  },

  // Fermeture de l'application
  quitApp: () => {
    ipcRenderer.send('app:quit');
  },

  // Ouverture d'un lien web dans le navigateur système par défaut
  openExternal: (url) => {
    shell.openExternal(url);
  }
});
