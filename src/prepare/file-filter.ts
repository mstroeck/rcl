import picomatch from 'picomatch';

/**
 * Default patterns to ignore (common build artifacts and dependencies)
 */
export const DEFAULT_IGNORE_PATTERNS = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '*.min.js',
  '*.min.css',
  '*.map',
  'dist/**',
  'build/**',
  'vendor/**',
  'node_modules/**',
  '.next/**',
  '.nuxt/**',
  'out/**',
  'coverage/**',
  '.cache/**',
  '.env',
  '.env.*',
  '*.pem',
  '*.key',
  '*.p12',
  '*.pfx',
];

/**
 * File filter configuration
 */
export interface FileFilterConfig {
  /** Glob patterns to ignore (exclude from review) */
  ignore: string[];
  /** Glob patterns to include (only review these) */
  include: string[];
}

/**
 * Create a file filter function based on ignore/include patterns
 */
export function createFileFilter(config: FileFilterConfig): (filePath: string) => boolean {
  // Combine default ignores with user-specified ignores
  const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...config.ignore];

  // Create matchers - only create if we have patterns
  const ignoreMatcher = allIgnorePatterns.length > 0
    ? picomatch(allIgnorePatterns, { dot: true })
    : () => false;
  const includeMatcher = config.include.length > 0
    ? picomatch(config.include, { dot: true })
    : null;

  return (filePath: string): boolean => {
    // If include patterns specified, check them first
    // Files must match include AND not match ignore
    if (includeMatcher) {
      if (!includeMatcher(filePath)) {
        return false; // Doesn't match include pattern
      }
      // Matches include, now check if it's explicitly ignored
      return !ignoreMatcher(filePath);
    }

    // No include patterns - just check ignore patterns
    return !ignoreMatcher(filePath);
  };
}

/**
 * Filter a list of file paths based on ignore/include patterns
 */
export function filterFiles(
  filePaths: string[],
  config: FileFilterConfig
): { included: string[]; excluded: string[] } {
  const filter = createFileFilter(config);
  const included: string[] = [];
  const excluded: string[] = [];

  for (const filePath of filePaths) {
    if (filter(filePath)) {
      included.push(filePath);
    } else {
      excluded.push(filePath);
    }
  }

  return { included, excluded };
}
