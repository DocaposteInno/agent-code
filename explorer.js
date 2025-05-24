import fs from 'fs';
import path from 'path';

export function getDirectoryTree(targetPath) {
  const stats = fs.statSync(targetPath);
  const info = {
    path: targetPath,
    name: path.basename(targetPath)
  };

  if (stats.isDirectory()) {
    const children = fs.readdirSync(targetPath).filter(name =>
      !['node_modules', '.git'].includes(name)
    );

    info.type = 'directory';
    info.children = children.map(child =>
      getDirectoryTree(path.join(targetPath, child))
    );
  } else {
    info.type = 'file';
    try {
      info.content = fs.readFileSync(targetPath, 'utf8');
    } catch (e) {
      info.content = "(Fichier binaire ou non lisible en texte)";
    }
  }

  return info;
}