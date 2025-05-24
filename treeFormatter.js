export function formatTreeAsText(node, prefix = '') {
  let result = `${prefix}${node.type === 'directory' ? '📁' : '📄'} ${node.name}\n`;

  if (node.type === 'directory' && node.children) {
    const lastIndex = node.children.length - 1;
    node.children.forEach((child, index) => {
      const isLast = index === lastIndex;
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      result += formatTreeAsText(child, prefix + (isLast ? '└── ' : '├── '));
    });
  }

  return result;
}