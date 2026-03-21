const TREK_TAGS = new Set(['treks', 'trek']);

export function getThemeForTags(tags: string[]): 'tech' | 'trek' {
  return tags.some((t) => TREK_TAGS.has(t)) ? 'trek' : 'tech';
}

export function getTagVariant(tag: string): 'tech' | 'trek' | 'neutral' {
  if (TREK_TAGS.has(tag.toLowerCase())) return 'trek';
  const techKeywords = ['devops', 'kubernetes', 'k8s', 'aws', 'docker', 'programming', 'python', 'django', 'postgres', 'postgresql', 'sql', 'nginx', 'kafka', 'linux'];
  if (techKeywords.some(k => tag.toLowerCase().includes(k))) return 'tech';
  return 'neutral';
}
