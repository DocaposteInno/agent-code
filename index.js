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

// interaction avec l'ia
app.post('/ask', async (req, res) => {
  let { question, projectPath } = req.body;
  if (!question) return res.status(400).json({ error: 'Missing question in request body.' });

  // Si projectPath non fourni, on prend le dernier utilisé
  if (!projectPath) {
    projectPath = lastProjectPath;
    console.log(`[ASK] projectPath utilisé depuis mémoire :`, projectPath);
  } else {
    console.log(`[ASK] projectPath fourni :`, projectPath);
  }

  if (!projectPath) return res.status(400).json({ error: 'Aucun chemin de projet connu. Veuillez explorer ou uploader un projet d’abord.' });

  // Log de la question reçue
  console.log(`[ASK] Question reçue :`, question);

  try {
    // Ajout du contexte d'arborescence
    let messages = [];
    const tree = getDirectoryTree(projectPath);
    const treeJson = JSON.stringify(tree, null, 2);

    // Si la question demande explicitement l'arborescence :
    if (
      question.toLowerCase().includes('arborescence') ||
      question.toLowerCase().includes('structure du projet')
    ) {
      const treeText = formatTreeAsText(tree);
      console.log('[ASK] Arborescence formatée envoyée à l\'utilisateur :\n' + treeText);
      return res.json({ answer: treeText });
    }

    const systemPrompt = `Voici l'arborescence complète du projet sur lequel tu dois répondre aux questions :
${treeJson}

Règle ABSOLUE :
- Si l'utilisateur te demande de créer, modifier, renommer ou supprimer un fichier/dossier, tu dois répondre UNIQUEMENT avec un objet JSON d'action, sans aucun texte autour, sans explication, sans balise Markdown, sans phrase d'introduction.
- Exemple : {"action":"delete-file","filePath":"/chemin/vers/fichier.js"}
- Si l'utilisateur te demande de créer ou supprimer plusieurs fichiers/dossiers, réponds UNIQUEMENT avec un objet JSON de ce type :
  { "action": "batch", "create": [ { "filePath": "...", "content": "" }, ... ], "delete": [ "chemin1", "chemin2", ... ] }
- Ne mets aucun texte autour, aucune explication, aucune balise Markdown.
- Pour toute autre question, réponds normalement.
- Ne montre jamais l'arborescence à l'utilisateur dans tes réponses.
`;
    messages.push({ role: 'system', content: systemPrompt });
    // Log du contexte système
    console.log(`[ASK] Prompt système généré pour l'IA (non visible utilisateur)`);
    messages.push({ role: 'user', content: question });

    // Log complet du payload envoyé au LLM
    console.log('[ASK] Payload envoyé au LLM :');
    console.log(JSON.stringify({
      messages,
      temperature: 0.1,
      max_tokens: 1000
    }, null, 2));

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
    // Log de la réponse IA (affiche tout)
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

  lastProjectPath = projectPath; // On mémorise le chemin

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Agent IA Azure opérationnel sur http://localhost:${PORT}`);
});