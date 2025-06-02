# Installation et Configuration de My-Agent-IA

## Prérequis

- Node.js (version 18 ou supérieure)
- npm (version 7 ou supérieure)

## Installation

1. Clonez le dépôt GitHub :
   ```bash
   git clone <URL_DU_DEPOT>
   cd my-agent-ia
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

## Configuration

1. Créez un fichier `.env` à la racine du projet et ajoutez les variables d'environnement nécessaires :
   ```env
   AZURE_OPENAI_API_KEY=your_api_key
   AZURE_OPENAI_API_INSTANCE_NAME=your_instance_name
   AZURE_OPENAI_API_DEPLOYMENT_NAME=your_deployment_name
   AZURE_OPENAI_API_VERSION=2024-06-01
   PORT=3000
   ```

2. Assurez-vous que les valeurs des variables d'environnement correspondent à votre configuration Azure.

## Lancement

1. Démarrez le serveur :
   ```bash
   npm start
   ```

2. Accédez à l'application via votre navigateur à l'adresse : `http://localhost:3000`

## Utilisation

- Utilisez l'interface web pour explorer les projets, discuter avec l'IA, et gérer les fichiers.

## Dépannage

- Vérifiez que toutes les variables d'environnement sont correctement définies dans le fichier `.env`.
- Assurez-vous que le service Azure OpenAI est correctement configuré et accessible.
