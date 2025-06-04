# Documentation d'utilisation pour My Agent IA

## Prérequis

- Node.js version 18 ou supérieure
- npm (inclus avec Node.js)
- Accès à Internet pour télécharger les dépendances

## Installation

1. Clonez le dépôt GitHub :
   ```bash
   git clone <URL_DU_DEPOT_GITHUB>
   ```

2. Accédez au répertoire du projet :
   ```bash
   cd my-agent-ia
   ```

3. Installez les dépendances :
   ```bash
   npm install
   ```

## Configuration

1. Créez un fichier `.env` à la racine du projet et ajoutez les variables d'environnement nécessaires :
   ```env
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_API_INSTANCE_NAME=your_instance_name
   AZURE_OPENAI_API_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=your_api_version
   PORT=3000
   ```

2. Assurez-vous que les valeurs des variables d'environnement sont correctes et correspondent à votre configuration Azure.

## Lancement

1. Démarrez le serveur :
   ```bash
   npm start
   ```

2. Accédez à l'application dans votre navigateur à l'adresse : `http://localhost:3000`

## Dépannage

- Si vous rencontrez des problèmes lors de l'installation des dépendances, assurez-vous que votre version de Node.js est compatible.
- Vérifiez que toutes les variables d'environnement dans le fichier `.env` sont correctement définies.
- Consultez les logs du serveur pour plus de détails sur les erreurs potentielles.
