const { spawn, exec } = require('child_process');
const fs = require('fs');
const config = require('./config');

class DockerManager {
  constructor() {
    this.isStopping = false;
  }

  /**
   * Exécute une commande système et renvoie une promesse.
   */
  runCommand(command, args = [], options = {}, onLog = null) {
    return new Promise((resolve, reject) => {
      const isWin = process.platform === 'win32';
      const fullCmd = [command, ...args].join(' ');
      
      const child = isWin
        ? spawn('cmd.exe', ['/c', fullCmd], {
            cwd: config.projectRoot,
            env: { ...process.env },
            windowsHide: true,
            ...options
          })
        : spawn(command, args, {
            cwd: config.projectRoot,
            env: { ...process.env },
            ...options
          });

      let stdoutData = '';
      let stderrData = '';

      if (child.stdout) {
        child.stdout.on('data', (data) => {
          const text = data.toString();
          stdoutData += text;
          if (onLog) onLog(text, 'stdout');
        });
      }

      if (child.stderr) {
        child.stderr.on('data', (data) => {
          const text = data.toString();
          stderrData += text;
          if (onLog) onLog(text, 'stderr');
        });
      }

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ code, stdout: stdoutData, stderr: stderrData });
        } else {
          const error = new Error(`Command failed with exit code ${code}: ${fullCmd}\n${stderrData || stdoutData}`);
          error.code = code;
          error.stdout = stdoutData;
          error.stderr = stderrData;
          reject(error);
        }
      });
    });
  }

  /**
   * Vérifie si le démon Docker est accessible et en fonctionnement.
   */
  async checkDockerDaemon() {
    try {
      await this.runCommand('docker', ['info']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tente de lancer Docker Desktop si celui-ci n'est pas actif.
   */
  async launchDockerDesktop(onLog = null) {
    const isWin = process.platform === 'win32';
    const isLinux = process.platform === 'linux';

    if (isWin) {
      let desktopPath = config.windowsDockerDesktopPaths.find(p => fs.existsSync(p));
      
      if (desktopPath) {
        if (onLog) onLog(`Lancement de Docker Desktop depuis : ${desktopPath}...\n`, 'info');
        // Lancement détaché pour ne pas bloquer le processus Node
        const child = spawn(`"${desktopPath}"`, [], {
          detached: true,
          shell: true,
          stdio: 'ignore'
        });
        child.unref();
        return true;
      } else {
        if (onLog) onLog("Chemin d'installation standard de Docker Desktop non trouvé.\n", 'warn');
        // Tentative via la commande start standard
        spawn('cmd.exe', ['/c', 'start "" "Docker Desktop"'], { detached: true, stdio: 'ignore' }).unref();
        return true;
      }
    } else if (isLinux) {
      if (onLog) onLog("Tentative d'activation du service Docker sous Linux...\n", 'info');
      try {
        await this.runCommand('systemctl', ['--user', 'start', 'docker']);
        return true;
      } catch {
        try {
          await this.runCommand('systemctl', ['start', 'docker']);
          return true;
        } catch (e) {
          if (onLog) onLog(`Erreur lors du démarrage du service Docker: ${e.message}\n`, 'warn');
          return false;
        }
      }
    }
    return false;
  }

  /**
   * Attend activement que le démon Docker réponde.
   */
  async waitForDockerDaemon(onProgress = null, timeoutMs = config.dockerStartTimeoutMs) {
    const startTime = Date.now();
    let isInitialCheck = true;

    while (Date.now() - startTime < timeoutMs) {
      const isRunning = await this.checkDockerDaemon();
      if (isRunning) {
        return true;
      }

      if (isInitialCheck) {
        if (onProgress) onProgress("Démon Docker inactif. Démarrage de Docker Desktop en arrière-plan...", 'info');
        await this.launchDockerDesktop(onProgress);
        isInitialCheck = false;
      } else {
        const elapsedSec = Math.round((Date.now() - startTime) / 1000);
        if (onProgress) {
          onProgress(`En attente du démarrage du moteur Docker (${elapsedSec}s / ${Math.round(timeoutMs / 1000)}s)...`, 'waiting');
        }
      }

      // Attente de 2.5 secondes entre chaque tentative
      await new Promise(r => setTimeout(r, 2500));
    }

    throw new Error(`Délai d'attente dépassé (${Math.round(timeoutMs / 1000)}s) pour l'initialisation du démon Docker.`);
  }

  /**
   * Télécharge la dernière image officielle via docker compose pull.
   * Si une erreur réseau survient, continue avec l'image locale sans échouer.
   */
  async pullImages(onLog = null) {
    try {
      if (onLog) onLog("Vérification et mise à jour de l'image officielle DeepTutor (docker compose pull)...\n", 'info');
      await this.runCommand('docker', ['compose', 'pull'], {}, onLog);
      if (onLog) onLog("Image Docker à jour !\n", 'info');
      return true;
    } catch (err) {
      if (onLog) {
        onLog(`[Avertissement] Impossible de mettre à jour l'image en ligne (${err.message}). Utilisation de l'image locale existante.\n`, 'warn');
      }
      return false;
    }
  }

  /**
   * Démarre les conteneurs avec docker compose up -d.
   */
  async startContainers(onLog = null) {
    if (onLog) onLog("Lancement des conteneurs DeepTutor (docker compose up -d)...\n", 'info');
    await this.runCommand('docker', ['compose', 'up', '-d'], {}, onLog);
    if (onLog) onLog("Conteneurs DeepTutor lancés avec succès en arrière-plan.\n", 'info');
    return true;
  }

  /**
   * Arrêt propre des conteneurs via docker compose stop pour libérer mémoire et GPU.
   */
  async stopContainers(onLog = null) {
    if (this.isStopping) return;
    this.isStopping = true;

    try {
      if (onLog) onLog("Arrêt propre des conteneurs DeepTutor (docker compose stop)...\n", 'info');
      await this.runCommand('docker', ['compose', 'stop'], { timeout: 15000 }, onLog);
      if (onLog) onLog("Ressources système et conteneurs libérés.\n", 'info');
      return true;
    } catch (err) {
      if (onLog) onLog(`Erreur lors de l'arrêt des conteneurs: ${err.message}\n`, 'error');
      return false;
    }
  }
}

module.exports = new DockerManager();
