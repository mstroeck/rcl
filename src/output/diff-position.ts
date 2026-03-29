/**
 * Parses a unified diff patch string and returns a map from new-file line number to diff position.
 *
 * GitHub's createReview API requires `position` (the line index within the diff hunk),
 * NOT the absolute file line number.
 *
 * @param patch - Unified diff patch string
 * @returns Map from new-file line number (absolute) to diff position (1-based index within patch)
 */
export function parseDiffPositions(patch: string): Map<number, number> {
  const lineNumberToPosition = new Map<number, number>();

  if (!patch) {
    return lineNumberToPosition;
  }

  const lines = patch.split('\n');
  let position = 0; // 1-based index within the patch
  let currentNewLine = 0; // Current line number in the new file

  for (const line of lines) {
    position++;

    // Parse hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    if (line.startsWith('@@')) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        currentNewLine = parseInt(match[1], 10);
        // Don't map the hunk header itself
        continue;
      }
    }

    // Context line (space) or addition (+) - these map to new file lines
    if (line.startsWith(' ') || line.startsWith('+')) {
      lineNumberToPosition.set(currentNewLine, position);
      currentNewLine++;
    }
    // Deletion (-) - doesn't map to a new file line, just increment position
    // (position increments but currentNewLine does not)
  }

  return lineNumberToPosition;
}
