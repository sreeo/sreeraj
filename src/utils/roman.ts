const TABLE: Array<[number, string]> = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

export function roman(n: number): string {
  let out = '';
  for (const [v, s] of TABLE) {
    while (n >= v) { out += s; n -= v; }
  }
  return out;
}

export const romanLower = (n: number) => roman(n).toLowerCase();

const LATIN_MONTHS = [
  'Ianuarii', 'Februarii', 'Martii', 'Aprilis', 'Maii', 'Iunii',
  'Iulii', 'Augusti', 'Septembris', 'Octobris', 'Novembris', 'Decembris',
];

export const latinMonth = (d: Date) => LATIN_MONTHS[d.getUTCMonth()];

// Latin numerals in their incunable spelling: V for U, final i as j is too much.
export const latinize = (s: string) => s.toUpperCase().replace(/U/g, 'V');
