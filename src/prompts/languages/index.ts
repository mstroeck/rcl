import { TYPESCRIPT_SPECIFIC } from './typescript.js';
import { PYTHON_SPECIFIC } from './python.js';
import { JAVASCRIPT_SPECIFIC } from './javascript.js';
import { RUST_SPECIFIC } from './rust.js';

const LANGUAGE_PROMPTS: Record<string, string> = {
  typescript: TYPESCRIPT_SPECIFIC,
  javascript: JAVASCRIPT_SPECIFIC,
  python: PYTHON_SPECIFIC,
  rust: RUST_SPECIFIC,
};

export function getLanguagePrompt(language: string): string | null {
  if (!language) return null;
  return LANGUAGE_PROMPTS[language.toLowerCase()] || null;
}
