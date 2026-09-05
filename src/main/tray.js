const { Tray, Menu, app } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;

/**
 * Initialise l'icône dans la zone de notification (System Tray).
 */
function setupTray(mainWindow, onRestart) {
  // Chemin de l'icône pour le Tray
  const iconPath = path.join(__dirname, '../renderer/assets/icon.png');

  if (!fs.existsSync(iconPath)) {
    // Si l'icône n'existe pas encore, on évite le crash
    return null;
  }

  try {
    tray = new Tray(iconPath);
    tray.setToolTip('DeepTutor Desktop');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'DeepTutor Desktop',
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Afficher la fenêtre',
        click: () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Redémarrer les services Docker',
        click: () => {
          if (onRestart) onRestart();
        }
      },
      { type: 'separator' },
      {
        label: 'Arrêter et quitter',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });

    return tray;
  } catch (err) {
    console.warn('[Tray] Impossible de créer le System Tray:', err.message);
    return null;
  }
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

module.exports = {
  setupTray,
  destroyTray
};
