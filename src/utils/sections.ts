// The four sections of the poster, in the order they are shouted.
export interface Section {
  name: string;
  label: string;
  href: string;
  match: string[];
  blurb: string;
}

export const SECTIONS: Section[] = [
  {
    name: 'devops',
    label: 'DevOps',
    href: '/devops/',
    match: ['devops'],
    blurb: 'Kubernetes, pipelines, proxies — the machinery underneath.',
  },
  {
    name: 'postgres',
    label: 'Postgres',
    href: '/postgres/',
    match: ['postgres'],
    blurb: 'Indexes, identifiers and benchmarks from inside the database.',
  },
  {
    name: 'programming',
    label: 'Programming',
    href: '/programming/',
    match: ['programming'],
    blurb: 'Workflows, tooling and code — how the work gets done.',
  },
  {
    name: 'treks',
    label: 'Treks',
    href: '/treks/',
    match: ['treks', 'trek'],
    blurb: 'Himalayan passes and summits, and what went wrong.',
  },
];

export function sectionFor(tags: string[]): Section | undefined {
  return SECTIONS.find((s) => s.match.some((m) => tags.includes(m)));
}

export function catFor(tags: string[]): string {
  return sectionFor(tags)?.label ?? tags[0] ?? 'Notes';
}

export function isTrek(tags: string[]): boolean {
  return tags.some((t) => t === 'treks' || t === 'trek');
}
