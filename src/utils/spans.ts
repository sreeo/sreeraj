// Asymmetric column rhythm for post compositions. Each row of the
// 12-column band sums to 12, but no two adjacent rows repeat:
// [7,5] [4,3,5] [8,4] [5,7] [3,4,5] [6,6] [4,8] [5,3,4]
const SEQ = [
  'c7', 'c5',
  'c4', 'c3', 'c5',
  'c8', 'c4',
  'c5', 'c7',
  'c3', 'c4', 'c5',
  'c6', 'c6',
  'c4', 'c8',
  'c5', 'c3', 'c4',
];

export function spanFor(i: number): string {
  return SEQ[i % SEQ.length];
}
