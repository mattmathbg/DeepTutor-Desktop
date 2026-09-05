const http = require('http');
const config = require('./config');

/**
 * Effectue un healthcheck HTTP sur l'URL de DeepTutor.
 */
function probeHttp(url) {
  return new Promise((resolve) => {
    try {
      const parsedUrl = new URL(url);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname || '/',
          method: 'GET',
          timeout: 2000,
          headers: {
            'User-Agent': 'DeepTutor-Desktop-Healthcheck/1.0'
          }
        },
        (res) => {
          // Si le serveur répond avec un code HTTP valide (200, 302, etc.), le service est prêt
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            resolve(true);
          } else {
            resolve(false);
          }
        }
      );

      req.on('error', () => {
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Attend que le serveur HTTP DeepTutor soit disponible en sondant l'adresse en boucle.
 */
async function waitForDeepTutorReady(onProgress = null, timeoutMs = config.healthcheckTimeoutMs) {
  const startTime = Date.now();
  const url = config.appUrl;

  while (Date.now() - startTime < timeoutMs) {
    const isReady = await probeHttp(url);
    if (isReady) {
      return true;
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    if (onProgress) {
      onProgress(`En attente de réponse du serveur DeepTutor (${elapsed}s)...`);
    }

    await new Promise((r) => setTimeout(r, config.healthcheckIntervalMs));
  }

  throw new Error(`Délai d'attente dépassé (${Math.round(timeoutMs / 1000)}s) en attendant la réponse HTTP sur ${url}.`);
}

module.exports = {
  probeHttp,
  waitForDeepTutorReady
};
