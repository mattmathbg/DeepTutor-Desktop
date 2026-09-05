const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Détermination du répertoire racine du projet (dev vs packaged)
let isPackaged = false;
try {
  const { app } = require('electron');
  if (app && typeof app.isPackaged === 'boolean') {
    isPackaged = app.isPackaged;
  }
} catch {
  isPackaged = false;
}

// En mode portable, les fichiers (data, .env, docker-compose) sont stockés à côté du binaire portable
const portableDir = process.env.PORTABLE_EXECUTABLE_DIR;
const projectRoot = portableDir || ((isPackaged && process.resourcesPath)
  ? process.resourcesPath
  : path.resolve(__dirname, '../../'));

// Détermination et synchronisation des fichiers de configuration
const envPath = path.join(projectRoot, '.env');
let envExamplePath = path.join(projectRoot, '.env.example');
let composePath = path.join(projectRoot, 'docker-compose.yml');

// Si exécuté en mode packagé/portable et que les fichiers ne sont pas dans projectRoot, chercher dans resources
if (isPackaged && process.resourcesPath) {
  const resExample = path.join(process.resourcesPath, '.env.example');
  const resCompose = path.join(process.resourcesPath, 'docker-compose.yml');

  if (!fs.existsSync(envExamplePath) && fs.existsSync(resExample)) {
    try { fs.copyFileSync(resExample, envExamplePath); } catch {}
  }
  if (!fs.existsSync(composePath) && fs.existsSync(resCompose)) {
    try { fs.copyFileSync(resCompose, composePath); } catch { composePath = resCompose; }
  }
}

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  try {
    fs.copyFileSync(envExamplePath, envPath);
    console.log('[Config] .env créé automatiquement à partir de .env.example');
  } catch (err) {
    console.warn('[Config] Impossible de copier .env.example:', err.message);
  }
}

// Chargement des variables d'environnement
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Création garantie du dossier de données persistantes
const dataDir = path.join(projectRoot, 'data');
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (err) {
    console.warn('[Config] Impossible de créer le dossier data:', err.message);
  }
}

const config = {
  isPackaged,
  projectRoot,
  dockerComposeFile: composePath,
  dataDir,
  appPort: parseInt(process.env.DEEPTUTOR_PORT || '3782', 10),
  backendPort: parseInt(process.env.DEEPTUTOR_BACKEND_PORT || '8001', 10),
  appUrl: `http://127.0.0.1:${process.env.DEEPTUTOR_PORT || '3782'}`,
  
  // Chemins connus pour Docker Desktop sur Windows
  windowsDockerDesktopPaths: [
    'C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Programs\\Docker\\Docker\\Docker Desktop.exe')
  ],
  
  // Délais et temporisations
  dockerStartTimeoutMs: 90000,   // 90 secondes max pour attendre Docker Desktop
  healthcheckTimeoutMs: 120000,  // 2 minutes max pour le premier boot du conteneur
  healthcheckIntervalMs: 1200    // Vérification toutes les 1.2 secondes
};

module.exports = config;
