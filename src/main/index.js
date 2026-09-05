const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const config = require('./config');
const dockerManager = require('./docker');
const { waitForDeepTutorReady } = require('./healthcheck');
const { setupTray, destroyTray } = require('./tray');

let mainWindow = null;
let isQuitting = false;
let isDeepTutorReady = false;

// Empêcher les instances multiples
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

/**
 * Création de la fenêtre principale de l'application
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    title: 'DeepTutor Desktop',
    icon: path.join(__dirname, '../renderer/assets/icon.png'),
    backgroundColor: '#0a0d14',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webviewTag: false
    }
  });

  // Supprimer le menu par défaut pour un rendu d'application native épuré
  Menu.setApplicationMenu(null);

  // Charger le splashscreen local
  const splashPath = path.join(__dirname, '../renderer/splash.html');
  mainWindow.loadFile(splashPath);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    startDeepTutorLifecycle();
  });

  // Gestion de la fermeture de fenêtre
  mainWindow.on('close', async (e) => {
    if (!isQuitting) {
      e.preventDefault();
      await handleCleanShutdown();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialisation du System Tray
  setupTray(mainWindow, () => {
    startDeepTutorLifecycle();
  });
}

/**
 * Diffuse un statut vers le splashscreen
 */
function sendStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed() && !isDeepTutorReady) {
    mainWindow.webContents.send('docker:status', data);
  }
}

/**
 * Diffuse un message de log vers le splashscreen
 */
function sendLog(message, type = 'stdout') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('docker:log', { message, type });
  }
  console.log(`[Docker ${type.toUpperCase()}] ${message.trim()}`);
}

/**
 * Cycle de vie complet : Démon -> Pull -> Up -> Healthcheck -> Redirection
 */
async function startDeepTutorLifecycle() {
  isDeepTutorReady = false;

  try {
    // Étape 1 : Vérification et attente du démon Docker
    sendStatus({
      step: 0,
      badge: 'Vérification',
      title: 'Vérification du moteur Docker...',
      detail: 'Contrôle de la disponibilité du démon Docker local',
      error: false
    });

    await dockerManager.waitForDockerDaemon(
      (msg) => {
        sendStatus({
          step: 0,
          badge: 'Docker',
          title: msg,
          detail: 'Veuillez patienter pendant le démarrage du service',
          error: false
        });
      }
    );

    sendLog('Démon Docker opérationnel.\n', 'info');

    // Étape 2 : Mise à jour automatique de l'image officielle
    sendStatus({
      step: 1,
      badge: 'Mise à jour',
      title: 'Mise à jour de DeepTutor...',
      detail: 'Téléchargement de la dernière version officielle (docker compose pull)',
      error: false
    });

    await dockerManager.pullImages((text, type) => sendLog(text, type));

    // Étape 3 : Démarrage des conteneurs
    sendStatus({
      step: 2,
      badge: 'Démarrage',
      title: 'Lancement des conteneurs DeepTutor...',
      detail: 'Exécution de docker compose up -d en arrière-plan',
      error: false
    });

    await dockerManager.startContainers((text, type) => sendLog(text, type));

    // Étape 4 : Healthcheck et attente du serveur HTTP
    sendStatus({
      step: 3,
      badge: 'Connexion',
      title: 'Initialisation de DeepTutor...',
      detail: `Attente de réponse du serveur sur ${config.appUrl}`,
      error: false
    });

    await waitForDeepTutorReady((msg) => {
      sendStatus({
        step: 3,
        badge: 'Attente',
        title: msg,
        detail: 'Les modèles IA et la base de données sont en cours de chargement',
        error: false
      });
    });

    // Étape 5 : Prêt et redirection
    isDeepTutorReady = true;
    sendStatus({
      step: 4,
      badge: 'Prêt',
      title: 'DeepTutor est prêt !',
      detail: 'Redirection vers votre espace de travail...',
      error: false
    });

    // Légère temporisation pour apprécier la complétion de la barre avant redirection
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(config.appUrl);
      }
    }, 600);

  } catch (error) {
    console.error('[Lifecycle Error]', error);
    sendLog(`[ERREUR FATALE] ${error.message}\n`, 'error');

    sendStatus({
      error: true,
      errorMessage: error.message,
      title: 'Échec de l\'orchestration',
      detail: 'Impossible de finaliser le lancement de DeepTutor'
    });
  }
}

/**
 * Arrêt propre des services Docker et fermeture de l'application
 */
async function handleCleanShutdown() {
  if (isQuitting) return;
  isQuitting = true;

  console.log('[App] Fermeture en cours, arrêt des conteneurs Docker...');

  if (mainWindow && !mainWindow.isDestroyed()) {
    // Si la fenêtre est encore ouverte, recharger le splashscreen avec un message d'extinction
    try {
      mainWindow.loadFile(path.join(__dirname, '../renderer/splash.html'));
      mainWindow.webContents.once('did-finish-load', () => {
        sendStatus({
          step: 2,
          badge: 'Arrêt',
          title: 'Arrêt des services DeepTutor...',
          detail: 'Libération de la mémoire vive et des ressources GPU (docker compose stop)',
          error: false
        });
      });
    } catch {
      // Ignorer si la fenêtre ne peut plus charger
    }
  }

  // Timeout de secours de 12 secondes maximum
  const fallbackTimer = setTimeout(() => {
    console.warn('[App] Timeout de secours atteint lors de l\'arrêt des conteneurs.');
    destroyTray();
    app.exit(0);
  }, 12000);

  try {
    await dockerManager.stopContainers((msg) => console.log(`[Docker Stop] ${msg}`));
  } catch (err) {
    console.error('[App] Erreur lors de l\'arrêt des conteneurs:', err.message);
  } finally {
    clearTimeout(fallbackTimer);
    destroyTray();
    app.exit(0);
  }
}

// IPC Handlers
ipcMain.on('app:retry', () => {
  startDeepTutorLifecycle();
});

ipcMain.on('app:quit', () => {
  handleCleanShutdown();
});

// Cycle de vie de l'application Electron
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', async (e) => {
  if (!isQuitting) {
    e.preventDefault();
    await handleCleanShutdown();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
