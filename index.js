import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { getDirectoryTree } from './explorer.js';
import { formatTreeAsText } from './treeFormatter.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';
import multer from 'multer';
import os from 'os';
import unzipper from 'unzipper';

dotenv.config();

const app = express();
app.use(express.json());
const upload = multer({ dest: os.tmpdir() }); // stocke temporairement

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.static(path.join(__dirname, 'public')));

const {
  AZURE_OPENAI_API_KEY,
  AZURE_OPENAI_API_INSTANCE_NAME,
  AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_API_DEPLOYMENT_NAME
} = process.env;

const AZURE_ENDPOINT = `https://${AZURE_OPENAI_API_INSTANCE_NAME}.openai.azure.com`;

// Variable globale pour mémoriser le dernier chemin de projet utilisé
let lastProjectPath = null;
let projectPaths = []; // Liste des chemins des projets explorés
// interaction avec l'ia
app.post('/ask', async (req, res) => {
  let { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question in request body.' });

  console.log(`[ASK] Question reçue :`, question);

  try {
    let messages = [];
    let combinedTreeJson = '';

    // Concatène les arborescences des projets explorés
    for (const projectPath of projectPaths) {
      const tree = getDirectoryTree(projectPath);
      const treeJson = JSON.stringify(tree, null, 2);
      combinedTreeJson += `Arborescence du projet (${projectPath}):\n${treeJson}\n\n`;
    }
const systemPrompt = `Voici les arborescences des projets sur lesquels tu dois répondre aux questions :
${combinedTreeJson}

Règle ABSOLUE :
- Si l'utilisateur te demande de créer une documentation d'utilisation (ex: install.md), tu dois générer un fichier markdown complet qui explique comment installer, configurer et lancer le projet sur une machine.
- Si l'utilisateur te demande de créer, modifier, renommer ou supprimer un fichier/dossier, tu dois répondre UNIQUEMENT avec un objet JSON d'action, sans aucun texte autour, sans explication, sans balise Markdown, sans phrase d'introduction.More actions
- Exemple : {"action":"delete-file","filePath":"/chemin/vers/fichier.js"}
- Si l'utilisateur te demande de créer ou supprimer plusieurs fichiers/dossiers, réponds UNIQUEMENT avec un objet JSON de ce type :
  { "action": "batch", "create": [ { "filePath": "...", "content": "" }, ... ], "delete": [ "chemin1", "chemin2", ... ] }
- Réponds UNIQUEMENT avec un objet JSON d'action de ce type :
  {"action":"create-file","filePath":"/chemin/vers/install.md","content":"...documentation complète..."}
- Ne mets aucun texte autour, aucune explication, aucune balise Markdown.
- Pour toute autre question, réponds normalement.
- Ne montre jamais les arborescences à l'utilisateur dans tes réponses.
`;

    messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: question });

    const response = await axios.post(
      `${AZURE_ENDPOINT}/openai/deployments/${AZURE_OPENAI_API_DEPLOYMENT_NAME}/chat/completions?api-version=${AZURE_OPENAI_API_VERSION}`,
      {
        messages,
        temperature: 0.1,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'api-key': AZURE_OPENAI_API_KEY,
          'x-ms-model-mesh-model-name': 'gpt-4o'
        }
      }
    );

    const answer = response.data.choices[0].message.content;
    console.log(`[ASK] Réponse IA complète :\n${answer}`);
    res.json({ answer });
  } catch (error) {
    const errorMessage = error?.response?.data?.error?.message || error.message;
    console.error("Erreur Azure OpenAI :", errorMessage);
    res.status(500).json({ error: errorMessage });
  }
});

// Arborescence
app.post('/explore', (req, res) => {
  const { projectPath } = req.body;
  console.log(`[EXPLORE] projectPath reçu :`, projectPath);
  if (!projectPath) return res.status(400).json({ error: 'projectPath is required' });

  if (!projectPaths.includes(projectPath)) {
    projectPaths.push(projectPath); // Ajoute le chemin au tableau
  }

  try {
    const tree = getDirectoryTree(projectPath);
    console.log(`[EXPLORE] Arborescence générée`);
    res.json(tree);
  } catch (error) {
    console.error("Erreur exploration :", error.message);
    res.status(500).json({ error: 'Impossible d’explorer le dossier.' });
  }
});



//  Créer fichier
app.post('/create-file', (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath requis' });

  try {
    fs.writeFileSync(filePath, content || '', 'utf8');
    res.json({ message: `Fichier créé : ${filePath}` });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Erreur création fichier' });
  }
});

//  Modifier fichier
app.post('/edit-file', (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath requis' });

  try {
    fs.writeFileSync(filePath, content, 'utf8');
    res.json({ message: `Fichier modifié : ${filePath}` });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Erreur modification fichier' });
  }
});

//  Renommer fichier
app.post('/rename-file', (req, res) => {
  const { oldPath, newPath } = req.body;
  if (!oldPath || !newPath) return res.status(400).json({ error: 'Chemins requis' });

  try {
    fs.renameSync(oldPath, newPath);
    res.json({ message: `Fichier renommé : ${newPath}` });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Erreur renommage fichier' });
  }
});

// upload fichier join
app.post('/upload', upload.single('projectFile'), async (req, res) => {
  if (!req.file) {
    console.log(`[UPLOAD] Aucun fichier reçu`);
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname;
  console.log(`[UPLOAD] Fichier reçu :`, originalName);

  if (originalName.endsWith('.zip')) {
    const extractPath = path.join(os.tmpdir(), path.basename(filePath) + '-unzipped');
    try {
      await fs.createReadStream(filePath).pipe(unzipper.Extract({ path: extractPath })).promise();
      console.log(`[UPLOAD] Zip décompressé dans :`, extractPath);
      lastProjectPath = extractPath; // On mémorise le chemin
      return res.json({ projectPath: extractPath });
    } catch (e) {
      console.error(`[UPLOAD] Erreur lors de la décompression :`, e.message);
      return res.status(500).json({ error: 'Erreur lors de la décompression.' });
    }
  }

  lastProjectPath = filePath; // On mémorise le chemin
  return res.json({ projectPath: filePath });
});

const uploadFolder = multer({ dest: os.tmpdir() });

app.post('/upload-folder', uploadFolder.array('projectFiles'), (req, res) => {
  if (!req.files || !req.files.length) {
    console.log(`[UPLOAD-FOLDER] Aucun fichier reçu`);
    return res.status(400).json({ error: 'Aucun fichier reçu.' });
  }

  // Crée un dossier temporaire pour reconstituer l'arborescence
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploaded-folder-'));
  console.log(`[UPLOAD-FOLDER] Création du dossier temporaire :`, tempDir);

  for (const file of req.files) {
    const destPath = path.join(tempDir, file.originalname);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.renameSync(file.path, destPath);
    console.log(`[UPLOAD-FOLDER] Fichier déplacé :`, file.originalname);
  }

  lastProjectPath = tempDir; // On mémorise le chemin
  res.json({ projectPath: tempDir });
});


//  Supprimer fichier
app.post('/delete-file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath requis' });

  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      res.json({ message: `Fichier ou dossier supprimé : ${filePath}` });
    } else {
      res.status(404).json({ error: 'Fichier ou dossier non trouvé.' });
    }
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: 'Erreur suppression fichier/dossier' });
  }
});

app.post('/batch-files', (req, res) => {
  const { create, delete: toDelete } = req.body;
  const results = { created: [], deleted: [], errors: [] };

  // Création de fichiers
  if (Array.isArray(create)) {
    for (const file of create) {
      try {
        fs.writeFileSync(file.filePath, file.content || '', 'utf8');
        results.created.push(file.filePath);
      } catch (e) {
        results.errors.push(`Erreur création ${file.filePath}: ${e.message}`);
      }
    }
  }

  // Suppression de fichiers
  if (Array.isArray(toDelete)) {
    for (const filePath of toDelete) {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
          results.deleted.push(filePath);
        } else {
          results.errors.push(`Non trouvé: ${filePath}`);
        }
      } catch (e) {
        results.errors.push(`Erreur suppression ${filePath}: ${e.message}`);
      }
    }
  }

  res.json(results);
});
import { exec } from 'child_process';

// 📥 Endpoint pour télécharger un repo GitHub
app.post('/github-download', (req, res) => {
  const { githubUrl } = req.body;

  if (!githubUrl) return res.status(400).json({ error: 'githubUrl requis' });

  // Définir un chemin temporaire
  const folderName = `repo_${Date.now()}`;
  const targetPath = path.join(os.tmpdir(), folderName);

  // Commande git clone
  const command = `git clone ${githubUrl} ${targetPath}`;

  exec(command, (err, stdout, stderr) => {
    if (err) {
      console.error('Erreur lors du téléchargement GitHub:', stderr);
      return res.status(500).json({ error: `Erreur lors du téléchargement : ${stderr}` });
    }

    console.log('Téléchargement réussi dans :', targetPath);
    return res.json({ projectPath: targetPath });
  });
});

app.post('/explore-file', (req, res) => {
  const { filePath } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath requis' });

  try {
    const content = fs.readFileSync(filePath, 'utf8'); // Lit le contenu du fichier
    res.json({ content });
  } catch (error) {
    console.error("Erreur lors de la lecture du fichier :", error.message);
    res.status(500).json({ error: 'Impossible de lire le fichier.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Agent IA Azure opérationnel sur http://localhost:${PORT}`);
});