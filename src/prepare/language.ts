const LANGUAGE_MAP: Record<string, string> = {
  // JavaScript/TypeScript
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mjs: 'javascript',
  cjs: 'javascript',

  // Python
  py: 'python',
  pyw: 'python',

  // Web
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',

  // Systems
  rs: 'rust',
  go: 'go',
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',

  // JVM
  java: 'java',
  kt: 'kotlin',
  scala: 'scala',

  // Other
  rb: 'ruby',
  php: 'php',
  swift: 'swift',
  cs: 'csharp',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  sql: 'sql',
  md: 'markdown',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  toml: 'toml',
};

const DOTFILE_MAP: Record<string, string> = {
  '.gitignore': 'text',
  '.dockerignore': 'text',
  '.env': 'config',
  '.editorconfig': 'config',
};

export function detectLanguage(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;

  // Handle dotfiles
  if (fileName.startsWith('.')) {
    // Check if it's a known dotfile
    if (DOTFILE_MAP[fileName]) {
      return DOTFILE_MAP[fileName];
    }

    // If it has only one dot (at the start), it's a dotfile without extension
    const dotCount = (fileName.match(/\./g) || []).length;
    if (dotCount === 1) {
      return 'text';
    }

    // If it has multiple dots (e.g., .eslintrc.js), use the extension
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext) {
      return LANGUAGE_MAP[ext] || 'text';
    }
  }

  const ext = filePath.split('.').pop()?.toLowerCase();
  if (!ext) return 'unknown';
  return LANGUAGE_MAP[ext] || 'unknown';
}

export function getLanguageContext(language: string): string {
  const contexts: Record<string, string> = {
    javascript: 'JavaScript/Node.js code',
    typescript: 'TypeScript code',
    python: 'Python code',
    rust: 'Rust code',
    go: 'Go code',
    java: 'Java code',
    cpp: 'C++ code',
    c: 'C code',
    ruby: 'Ruby code',
    php: 'PHP code',
    swift: 'Swift code',
    csharp: 'C# code',
    shell: 'Shell script',
  };

  return contexts[language] || `${language} code`;
}
