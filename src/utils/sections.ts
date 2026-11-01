// The four books (libri) of the volume, plus the miscellany at the back.
export interface Section {
  name: string;
  label: string;
  rubric: string;
  liber: string;
  href: string;
  match: string[];
  blurb: string;
}

export const SECTIONS: Section[] = [
  {
    name: 'devops',
    label: 'DevOps',
    rubric: 'DevOps',
    liber: 'Liber primus',
    href: '/devops/',
    match: ['devops'],
    blurb: 'Kubernetes, pipelines, reverse proxies and the machinery that keeps production standing.',
  },
  {
    name: 'postgres',
    label: 'Postgres',
    rubric: 'Postgres',
    liber: 'Liber secundus',
    href: '/postgres/',
    match: ['postgres'],
    blurb: 'Indexes, identifiers and benchmarks, measured from inside the database.',
  },
  {
    name: 'programming',
    label: 'Programming',
    rubric: 'Programmata',
    liber: 'Liber tertius',
    href: '/programming/',
    match: ['programming'],
    blurb: 'Workflows, tooling and code — how the work actually gets done.',
  },
  {
    name: 'treks',
    label: 'Treks',
    rubric: 'Itinera',
    liber: 'Liber quartus',
    href: '/treks/',
    match: ['treks', 'trek'],
    blurb: 'Himalayan passes and summits — itineraries, altitudes, and the days the weather won.',
  },
];

export const VARIA: Section = {
  name: 'varia',
  label: 'Miscellany',
  rubric: 'Varia',
  liber: 'Appendix',
  href: '/tags/',
  match: [],
  blurb: 'Django, Java, PDFs and soldering irons — notes that belong to no single book.',
};

export function sectionFor(tags: string[]): Section | undefined {
  return SECTIONS.find((s) => s.match.some((m) => tags.includes(m)));
}

export function isTrek(tags: string[]): boolean {
  return tags.some((t) => t === 'treks' || t === 'trek');
}
