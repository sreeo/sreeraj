const TREK_TAGS = new Set(['treks', 'trek']);

export function getThemeForTags(tags: string[]): 'tech' | 'trek' {
  return tags.some((t) => TREK_TAGS.has(t)) ? 'trek' : 'tech';
}
