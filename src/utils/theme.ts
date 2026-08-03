const TREK_TAGS = ['treks', 'trek'];

export function getThemeForTags(tags: string[]): 'tech' | 'trek' {
  return tags.some((t) => TREK_TAGS.includes(t)) ? 'trek' : 'tech';
}
