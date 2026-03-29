import { describe, it, expect } from 'vitest';
import { createFileFilter, filterFiles, DEFAULT_IGNORE_PATTERNS } from './file-filter.js';

describe('file-filter', () => {
  describe('createFileFilter', () => {
    it('should exclude default ignore patterns', () => {
      const filter = createFileFilter({ ignore: [], include: [] });

      expect(filter('package-lock.json')).toBe(false);
      expect(filter('yarn.lock')).toBe(false);
      expect(filter('pnpm-lock.yaml')).toBe(false);
      expect(filter('app.min.js')).toBe(false);
      expect(filter('dist/index.js')).toBe(false);
      expect(filter('node_modules/foo/bar.js')).toBe(false);
    });

    it('should include files not matching ignore patterns', () => {
      const filter = createFileFilter({ ignore: [], include: [] });

      expect(filter('src/index.ts')).toBe(true);
      expect(filter('lib/utils.js')).toBe(true);
      expect(filter('README.md')).toBe(true);
    });

    it('should apply custom ignore patterns', () => {
      const filter = createFileFilter({
        ignore: ['**/*.test.ts', 'temp/**'],
        include: [],
      });

      expect(filter('src/utils.test.ts')).toBe(false);
      expect(filter('temp/foo.js')).toBe(false);
      expect(filter('src/utils.ts')).toBe(true);
    });

    it('should respect include patterns when specified', () => {
      const filter = createFileFilter({
        ignore: [],
        include: ['src/**/*.ts', 'lib/**/*.js'],
      });

      expect(filter('src/index.ts')).toBe(true);
      expect(filter('src/utils/helper.ts')).toBe(true);
      expect(filter('lib/main.js')).toBe(true);
      expect(filter('README.md')).toBe(false);
      expect(filter('test/foo.ts')).toBe(false);
    });

    it('should apply ignore patterns even with include patterns', () => {
      const filter = createFileFilter({
        ignore: ['**/*.min.js'],
        include: ['**/*.js'],
      });

      expect(filter('src/app.js')).toBe(true);
      expect(filter('src/app.min.js')).toBe(false); // Ignored even though included
    });

    it('should handle nested paths correctly', () => {
      const filter = createFileFilter({
        ignore: ['dist/**'],
        include: [],
      });

      expect(filter('dist/index.js')).toBe(false);
      expect(filter('dist/nested/deep/file.js')).toBe(false);
      expect(filter('src/dist.js')).toBe(true); // Not in dist/ directory
    });
  });

  describe('filterFiles', () => {
    it('should separate included and excluded files', () => {
      const files = [
        'src/index.ts',
        'src/utils.ts',
        'package-lock.json',
        'dist/bundle.js',
        'README.md',
      ];

      const result = filterFiles(files, { ignore: [], include: [] });

      expect(result.included).toEqual([
        'src/index.ts',
        'src/utils.ts',
        'README.md',
      ]);
      expect(result.excluded).toEqual([
        'package-lock.json',
        'dist/bundle.js',
      ]);
    });

    it('should apply custom patterns', () => {
      const files = [
        'src/index.ts',
        'src/test.ts',
        'lib/main.js',
        'README.md',
      ];

      const result = filterFiles(files, {
        ignore: ['*.md'],
        include: ['src/**'],
      });

      expect(result.included).toEqual([
        'src/index.ts',
        'src/test.ts',
      ]);
      expect(result.excluded).toEqual([
        'lib/main.js',
        'README.md',
      ]);
    });

    it('should handle empty file list', () => {
      const result = filterFiles([], { ignore: [], include: [] });

      expect(result.included).toEqual([]);
      expect(result.excluded).toEqual([]);
    });
  });

  describe('DEFAULT_IGNORE_PATTERNS', () => {
    it('should include common lock files', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('package-lock.json');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('yarn.lock');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('pnpm-lock.yaml');
    });

    it('should include common build directories', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('dist/**');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('build/**');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('node_modules/**');
    });

    it('should include minified files', () => {
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.min.js');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.min.css');
      expect(DEFAULT_IGNORE_PATTERNS).toContain('*.map');
    });
  });
});
