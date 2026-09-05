# DeepTutor Desktop 🎓

> **Wrapper de bureau autonome et multiplateforme (Windows / Linux) pour [HKUDS/DeepTutor](https://github.com/HKUDS/DeepTutor).**  
> Transforme le service conteneurisé officiel en une véritable application native de bureau, sans nécessiter de cloner ni de compiler le code source de DeepTutor.

---

## 🌟 Fonctionnalités Clés

- 🔄 **Orchestration Docker Automatisée (Boîte Noire)** :
  - **Vérification préliminaire** : Teste la présence et l'activité du démon Docker (`docker info`). Si Docker Desktop n'est pas lancé, le démarre automatiquement en tâche de fond.
  - **Mise à jour transparente** : Récupère la dernière version officielle (`ghcr.io/hkuds/deeptutor:latest`) via `docker compose pull`. En cas d'absence de réseau, bascule sur l'image locale sans bloquer.
  - **Démarrage des services** : Démarre les conteneurs en mode détaché via `docker compose up -d`.
  - **Arrêt propre garanti** : Intercepte la fermeture de la fenêtre (`before-quit` / `close`) pour exécuter automatiquement `docker compose stop`, libérant instantanément la RAM et les accélérateurs GPU.
- 🎨 **Expérience Utilisateur & Splashscreen Premium** :
  - Design moderne sombre (glassmorphism, lueurs néon cyan/violettes, anneau de pulsation).
  - Indicateur d'étapes en temps réel (Docker → Mise à jour → Conteneurs → Prêt).
  - Console de journalisation intégrée et rétractable affichant la sortie standard et d'erreur Docker en direct.
  - Écran d'assistance avec bouton *Réessayer* et conseils de dépannage (WSL2, permissions).
- 🔍 **Healthcheck & Redirection Fluide** :
  - Sonde HTTP continue sur le port applicatif local (`http://127.0.0.1:3782`).
  - Redirection automatique et instantanée de la vue native dès que le serveur répond avec un code HTTP 200.
- 💾 **Persistance des Données & Support LLM** :
  - Montage de volume persistant (`./data` mappé sur `/app/data`) : conservation des modèles configurés, sessions, livres, espaces d'apprentissage et bases de données SQLite/PocketBase.
  - Résolution d'hôte `host.docker.internal` pour connecter des modèles locaux (Ollama, LM Studio, vLLM).
  - Gestion des clés d'API LLM (OpenAI, Gemini, DeepSeek, Anthropic, Mistral, Groq, etc.) via fichier `.env` préconfiguré.
- 🖥️ **Intégration Système OS** :
  - Fenêtre épurée sans barre d'adresses ni barre de menus superflue.
  - Icône dans la barre des tâches et System Tray (avec options d'ouverture, redémarrage et arrêt).

---

## 📁 Arborescence du Projet

```
DeepTutor-Desktop/
├── docker-compose.yml          # Définition des services Docker officiels
├── .env.example                # Modèle de variables d'environnement & clés API
├── .env                        # Fichier de configuration active (auto-généré)
├── .gitignore                  # Exclusion node_modules, logs et données sensibles
├── package.json                # Dépendances Electron et scripts de build
├── data/                       # Volume persistant monté dans /app/data
│   └── .gitkeep
├── scripts/
│   └── generate_icon.js        # Générateur d'icônes pour l'application
└── src/
    ├── main/
    │   ├── index.js            # Processus principal Electron & gestion de cycle de vie
    │   ├── docker.js           # Orchestrateur Docker (info, auto-start, pull, up, stop)
    │   ├── healthcheck.js      # Sonde HTTP résiliente (port 3782)
    │   ├── tray.js             # Intégration System Tray
    │   └── config.js           # Résolution dynamique des chemins et des ports
    ├── preload/
    │   └── preload.js          # Pont IPC contextBridge sécurisé
    └── renderer/
        ├── splash.html         # Écran de chargement graphique
        ├── splash.css          # Thème sombre haute fidélité
        ├── splash.js           # Contrôleur frontend & écoute IPC
        └── assets/
            ├── logo.svg        # Logo vectoriel animé DeepTutor
            └── icon.png        # Icône native pour fenêtre et System Tray
```

---

## 🚀 Démarrage Rapide

### Prérequis
1. **Node.js** (v18+) & **npm**
2. **Docker Desktop** (sous Windows avec backend WSL2 recommandé) ou le démon **Docker** sous Linux.

### 1. Installation des dépendances
```bash
npm install
```

### 2. Configuration des clés d'API (Optionnel)
Au premier lancement, le fichier `.env` est automatiquement généré à partir de `.env.example`.
Vous pouvez renseigner vos clés API dans `.env` :
```env
OPENAI_API_KEY=sk-...
DEEPSEEK_API_KEY=sk-...
GEMINI_API_KEY=AIza...
ANTHROPIC_API_KEY=sk-ant-...
```
> *Note : Vous pouvez également configurer vos clés directement depuis l'interface web de DeepTutor dans **Settings → Models**.*

### 3. Lancement de l'application
```bash
npm start
```
L'application démarre immédiatement avec le splashscreen, vérifie Docker, met à jour l'image, lance les conteneurs et vous redirige vers DeepTutor dès que le serveur est prêt.

---

## 📦 Création des Exécutables Autonomes (Packaging)

Pour empaqueter l'application sous forme de binaire installable ou portable :

### Pour Windows (.exe / installateur NSIS)
```bash
npm run package:win
```

### Pour Linux (.AppImage / .deb)
```bash
npm run package:linux
```
Les fichiers distribuables sont générés dans le dossier `release/`.

---

## 🦀 Alternative : Architecture Tauri v2 (Rust)

Si vous souhaitez recompiler ultérieurement cette application sous **Tauri v2** :

1. **Structure Tauri requise** :
   - `src-tauri/tauri.conf.json` : Déclaration de la fenêtre, permissions du plugin shell (`tauri-plugin-shell`).
   - `src-tauri/src/main.rs` : Orchestration des commandes Docker via `std::process::Command` ou `tokio::process::Command` pour l'asynchronisme.
2. **Équivalence Rust du cycle de vie** :
   ```rust
   // Vérification du démon
   let output = Command::new("docker").arg("info").output()?;
   // Démarrage conteneur
   Command::new("docker").args(["compose", "up", "-d"]).spawn()?;
   // Arrêt à la fermeture (événement tauri::WindowEvent::CloseRequested)
   Command::new("docker").args(["compose", "stop"]).status()?;
   ```
3. **Healthcheck** : Utilisation de la crate `reqwest` pour interroger `http://127.0.0.1:3782` en boucle asynchrone avant d'invoquer `window.eval("window.location.href = 'http://127.0.0.1:3782'")`.

---

## 🛡️ Données & Confidentialité
Toutes vos conversations, documents importés dans la base de connaissances et historiques d'apprentissage sont stockés localement dans le répertoire `./data`. Ils ne sont jamais envoyés vers des serveurs tiers en dehors des requêtes API adressées aux fournisseurs de modèles que vous aurez expressément configurés.
