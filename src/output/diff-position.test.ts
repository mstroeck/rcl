import { describe, it, expect } from 'vitest';
import { parseDiffPositions } from './diff-position.js';

describe('parseDiffPositions', () => {
  it('should parse simple add-only patch', () => {
    const patch = `@@ -0,0 +1,3 @@
+line 1
+line 2
+line 3`;

    const result = parseDiffPositions(patch);

    expect(result.get(1)).toBe(2); // First line is at position 2 (after hunk header)
    expect(result.get(2)).toBe(3);
    expect(result.get(3)).toBe(4);
  });

  it('should parse mixed add/delete/context patch', () => {
    const patch = `@@ -1,4 +1,4 @@
 context line 1
-deleted line
+added line
 context line 2`;

    const result = parseDiffPositions(patch);

    expect(result.get(1)).toBe(2); // context line 1
    expect(result.get(2)).toBe(4); // added line (position 3 is the deleted line)
    expect(result.get(3)).toBe(5); // context line 2
  });

  it('should parse multi-hunk patch', () => {
    const patch = `@@ -1,2 +1,2 @@
 line 1
+new line 2
@@ -10,2 +11,2 @@
 line 11
+new line 12`;

    const result = parseDiffPositions(patch);

    expect(result.get(1)).toBe(2); // First hunk, line 1
    expect(result.get(2)).toBe(3); // First hunk, new line 2
    expect(result.get(11)).toBe(5); // Second hunk, line 11
    expect(result.get(12)).toBe(6); // Second hunk, new line 12
  });

  it('should return undefined for line not in any hunk', () => {
    const patch = `@@ -1,2 +1,2 @@
 line 1
+line 2`;

    const result = parseDiffPositions(patch);

    expect(result.get(1)).toBe(2);
    expect(result.get(2)).toBe(3);
    expect(result.get(3)).toBeUndefined(); // Line 3 not in patch
    expect(result.get(100)).toBeUndefined(); // Line 100 not in patch
  });

  it('should handle empty patch', () => {
    const result = parseDiffPositions('');
    expect(result.size).toBe(0);
  });

  it('should handle patch with only deletions', () => {
    const patch = `@@ -1,3 +1,1 @@
 line 1
-deleted line 2
-deleted line 3`;

    const result = parseDiffPositions(patch);

    expect(result.get(1)).toBe(2); // Only context line maps
    expect(result.get(2)).toBeUndefined(); // No line 2 in new file
  });

  it('should handle complex real-world patch', () => {
    const patch = `@@ -10,7 +10,8 @@ function example() {
   const a = 1;
   const b = 2;
-  const c = 3;
+  const c = 4;
+  const d = 5;
   return a + b + c;
 }
 `;

    const result = parseDiffPositions(patch);

    expect(result.get(10)).toBe(2); // First context line
    expect(result.get(11)).toBe(3); // Second context line
    expect(result.get(12)).toBe(5); // Changed line (position 4 is deletion)
    expect(result.get(13)).toBe(6); // New line
    expect(result.get(14)).toBe(7); // Context line after changes
  });
});
