import { FileChange } from '../resolver/types.js';
import { detectLanguage, getLanguageContext } from './language.js';
import { DiffChunk } from './chunker.js';
import { createBoundary, wrapWithBoundary } from '../prompts/hardening.js';

export interface PromptOptions {
  includeFixSuggestions: boolean;
  promptHardening: boolean;
  language?: string;
}

// Helper function to escape triple backticks in diff content
function escapeDiffContent(diff: string): string {
  return diff.replace(/```/g, '\\`\\`\\`');
}

export function buildReviewPrompt(
  chunk: DiffChunk,
  options: PromptOptions
): string {
  const files = chunk.files;

  let prompt = `You are a code reviewer. Analyze the following code changes and identify potential issues.

Focus on:
- Bugs and logic errors
- Security vulnerabilities
- Performance problems
- Code quality issues
- Best practice violations
- Potential edge cases

`;

  if (options.includeFixSuggestions) {
    prompt += 'For each issue, provide a specific fix suggestion.\n\n';
  }

  // Build the diff content
  let diffContent = '';
  for (const file of files) {
    const language = detectLanguage(file.path);
    const context = getLanguageContext(language);

    diffContent += `File: ${file.path}\n`;
    diffContent += `Type: ${file.type}\n`;
    diffContent += `Language: ${context}\n`;
    diffContent += `Changes: +${file.additions}/-${file.deletions}\n\n`;

    if (file.diff) {
      // Escape triple backticks to prevent breaking the code fence
      const escapedDiff = escapeDiffContent(file.diff);
      diffContent += '```diff\n';
      diffContent += escapedDiff;
      diffContent += '\n```\n\n';
    }
  }

  // Wrap with security boundaries if hardening is enabled
  if (options.promptHardening) {
    const boundary = createBoundary();
    prompt += wrapWithBoundary(diffContent, boundary);
    prompt += '\n\n';
  } else {
    // Simple text separators when hardening is disabled
    prompt += '--- Diff ---\n\n';
    prompt += diffContent;
    prompt += '--- End Diff ---\n\n';
  }

  prompt += `Return your findings as a JSON array. Each finding must include:
- file: string (file path)
- line: number (line number where issue occurs)
- severity: "info" | "low" | "medium" | "high" | "critical"
- category: string (e.g., "security", "bug", "performance", "style")
- message: string (clear description of the issue)
- suggestion: string (how to fix it${!options.includeFixSuggestions ? ' - keep brief' : ''})

Example format:
[
  {
    "file": "src/example.ts",
    "line": 42,
    "severity": "high",
    "category": "security",
    "message": "SQL injection vulnerability",
    "suggestion": "Use parameterized queries"
  }
]

Return ONLY valid JSON. If no issues found, return empty array [].`;

  return prompt;
}

export function buildLanguageSpecificPrompt(language: string): string {
  const prompts: Record<string, string> = {
    javascript: `
Additional JavaScript/Node.js checks:
- Avoid == in favor of ===
- Check for unhandled promise rejections
- Look for potential memory leaks (event listeners, timers)
- Verify proper error handling in async functions
`,
    typescript: `
Additional TypeScript checks:
- Look for any types that should be more specific
- Check for missing null/undefined checks
- Verify generic type constraints
- Look for type assertions that could be unsafe
`,
    python: `
Additional Python checks:
- Look for mutable default arguments
- Check for except clauses that are too broad
- Verify proper resource cleanup (with statements)
- Look for SQL injection in string formatting
`,
    rust: `
Additional Rust checks:
- Look for unwrap() that could panic
- Check for unsafe blocks that could be avoided
- Verify proper error handling with Result
- Look for unnecessary clones or allocations
`,
  };

  return prompts[language] || '';
}
