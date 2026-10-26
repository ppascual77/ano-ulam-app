// Copy check for imported recipes: finds stretches of the rewritten
// description and steps that match the source page word for word.
//
// Ingredient names and amounts are facts and are never checked; the
// description and the steps are the recipe's written expression, which is
// what copyright protects. The importer's prompt asks for no run over 5
// words, but nothing enforced it; this does, and gates Confirm Seed.
//
// 8 words, not the prompt's 5: short cooking phrases ("salt and pepper to
// taste") recur everywhere and aren't anyone's expression. A matching run
// of 8+ words is copied text.

export const MIN_COPIED_WORDS = 8;

export type CheckedText = { label: string; text: string };
export type CopiedRun = { label: string; phrase: string };

function words(text: string) {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

export function findCopiedRuns(fields: CheckedText[], sourceText: string): CopiedRun[] {
  const source = words(sourceText);
  const sourceGrams = new Set<string>();
  for (let i = 0; i + MIN_COPIED_WORDS <= source.length; i++) {
    sourceGrams.add(source.slice(i, i + MIN_COPIED_WORDS).join(" "));
  }
  if (sourceGrams.size === 0) return [];

  const runs: CopiedRun[] = [];
  for (const field of fields) {
    const own = words(field.text);
    // Every word inside some 8-word window that also appears in the
    // source; overlapping windows merge into one run.
    const copied = new Array<boolean>(own.length).fill(false);
    for (let i = 0; i + MIN_COPIED_WORDS <= own.length; i++) {
      if (sourceGrams.has(own.slice(i, i + MIN_COPIED_WORDS).join(" "))) {
        for (let j = i; j < i + MIN_COPIED_WORDS; j++) copied[j] = true;
      }
    }
    let start = -1;
    for (let i = 0; i <= own.length; i++) {
      if (i < own.length && copied[i]) {
        if (start === -1) start = i;
      } else if (start !== -1) {
        runs.push({ label: field.label, phrase: own.slice(start, i).join(" ") });
        start = -1;
      }
    }
  }
  return runs;
}
