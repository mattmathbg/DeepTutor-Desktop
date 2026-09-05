// ==============================================================================
// DeepTutor Desktop - Splashscreen Controller
// ==============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const badgeText = document.getElementById('badge-text');
  const statusMessage = document.getElementById('status-message');
  const statusDetail = document.getElementById('status-detail');
  const progressBar = document.getElementById('progress-bar');
  const errorContainer = document.getElementById('error-container');
  const errorText = document.getElementById('error-text');
  const btnRetry = document.getElementById('btn-retry');
  const btnQuit = document.getElementById('btn-quit');
  const consoleToggle = document.getElementById('console-toggle');
  const consoleDrawer = document.getElementById('console-drawer');
  const consoleOutput = document.getElementById('console-output');
  const logCounter = document.getElementById('log-counter');
  const btnClearLogs = document.getElementById('btn-clear-logs');
  const linkGithub = document.getElementById('link-github');

  let logCount = 1;

  // Gestion des étapes visuelles (0: Docker, 1: Pull, 2: Up, 3: Init)
  function updateSteps(currentStep) {
    for (let i = 0; i <= 3; i++) {
      const stepItem = document.getElementById(`step-${i}`);
      const lineItem = document.getElementById(`line-${i}`);

      if (!stepItem) continue;

      if (i < currentStep) {
        stepItem.classList.remove('active');
        stepItem.classList.add('completed');
        if (lineItem) lineItem.classList.add('completed');
      } else if (i === currentStep) {
        stepItem.classList.add('active');
        stepItem.classList.remove('completed');
        if (lineItem) lineItem.classList.remove('completed');
      } else {
        stepItem.classList.remove('active', 'completed');
        if (lineItem) lineItem.classList.remove('completed');
      }
    }
  }

  // Écoute des statuts envoyés par le processus principal Electron
  if (window.deeptutorAPI && window.deeptutorAPI.onStatusChange) {
    window.deeptutorAPI.onStatusChange((data) => {
      if (data.step !== undefined) {
        updateSteps(data.step);
      }

      if (data.title) {
        statusMessage.textContent = data.title;
      }

      if (data.detail) {
        statusDetail.textContent = data.detail;
      }

      if (data.badge) {
        badgeText.textContent = data.badge;
      }

      if (data.error) {
        errorContainer.style.display = 'flex';
        errorText.textContent = data.errorMessage || 'Une erreur est survenue.';
        badgeText.textContent = 'Erreur';
        badgeText.parentElement.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        badgeText.parentElement.style.background = 'rgba(239, 68, 68, 0.15)';
        badgeText.style.color = '#f87171';
      } else {
        errorContainer.style.display = 'none';
        badgeText.parentElement.style.borderColor = 'rgba(56, 189, 248, 0.25)';
        badgeText.parentElement.style.background = 'rgba(56, 189, 248, 0.1)';
        badgeText.style.color = '#38bdf8';
      }
    });
  }

  // Écoute des logs Docker en direct
  if (window.deeptutorAPI && window.deeptutorAPI.onLogMessage) {
    window.deeptutorAPI.onLogMessage((data) => {
      const line = document.createElement('div');
      line.className = `log-line log-${data.type || 'stdout'}`;
      line.textContent = data.message;
      consoleOutput.appendChild(line);

      logCount++;
      logCounter.textContent = `${logCount} événements`;

      // Défilement automatique vers le bas
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    });
  }

  // Actions d'erreur
  btnRetry.addEventListener('click', () => {
    errorContainer.style.display = 'none';
    if (window.deeptutorAPI && window.deeptutorAPI.retryStartup) {
      window.deeptutorAPI.retryStartup();
    }
  });

  btnQuit.addEventListener('click', () => {
    if (window.deeptutorAPI && window.deeptutorAPI.quitApp) {
      window.deeptutorAPI.quitApp();
    }
  });

  // Dépliage / repliage du tiroir de terminal
  consoleToggle.addEventListener('click', () => {
    const isOpen = consoleDrawer.classList.toggle('open');
    consoleToggle.classList.toggle('open', isOpen);
  });

  // Bouton pour vider la console
  btnClearLogs.addEventListener('click', (e) => {
    e.stopPropagation();
    consoleOutput.innerHTML = '';
    logCount = 0;
    logCounter.textContent = '0 événements';
  });

  // Liens externes
  linkGithub.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.deeptutorAPI && window.deeptutorAPI.openExternal) {
      window.deeptutorAPI.openExternal('https://github.com/HKUDS/DeepTutor');
    }
  });
});
