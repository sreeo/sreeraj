// Turn raw markdown into a plain run of prose for shaped (goblet) setting.
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s.*$/gm, ' ')
    .replace(/^\s*(?:[-*+]|\d+\.)\s+.*$/gm, ' ')
    .replace(/^\s*\*\*[^*]+\*\*\s*$/gm, ' ')
    .replace(/[*_`>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Trim to roughly n characters, ending on a whole word.
export function trimWords(s: string, n: number): string {
  if (s.length <= n) return s;
  const head = s.slice(0, n);
  const stop = head.lastIndexOf('. ');
  if (stop > n * 0.6) return head.slice(0, stop + 1);
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]+$/, '');
}

export const PROFILES = {
  // full bowl, then a funnel narrowing to a point
  goblet: [1, 1, 1, 0.97, 0.9, 0.8, 0.68, 0.56, 0.44, 0.33, 0.23, 0.14],
  // the inverted triangle of a colophon
  funnel: [1, 0.86, 0.72, 0.58, 0.45, 0.33, 0.22, 0.12],
};

// Break words into lines whose lengths follow a profile. Finds the smallest
// width (in characters) at which every word fits into the profile's lines.
export function shapeLines(text: string, profile: number[]): { lines: string[]; width: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const fill = (width: number) => {
    const lines: string[] = [];
    let i = 0;
    for (const p of profile) {
      const target = Math.max(4, Math.round(width * p));
      let line = '';
      while (i < words.length) {
        const next = line ? `${line} ${words[i]}` : words[i];
        if (next.length > target && line) break;
        line = next;
        i++;
      }
      if (line) lines.push(line);
      if (i >= words.length) break;
    }
    return i >= words.length ? lines : null;
  };
  for (let w = 24; w <= 90; w++) {
    const lines = fill(w);
    if (lines) return { lines, width: w };
  }
  return { lines: [text], width: text.length };
}
