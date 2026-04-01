import { validateDesign } from './validate-design.js';
import fs from 'fs';

async function main() {
  const cssPath = process.argv[2] || '../src/styles/global.css';
  const css = fs.readFileSync(cssPath, 'utf-8');
  const result = await validateDesign(css);

  for (const step of result.steps) {
    const icon = step.passed ? 'PASS' : 'FAIL';
    console.log(`[${icon}] ${step.name}: ${step.message}`);
  }

  if (result.visionScore) {
    const s = result.visionScore;
    console.log(`\n── Vision Quality Breakdown ──`);
    console.log(`  Typography:       ${s.typography}/10`);
    console.log(`  Spacing:          ${s.spacing}/10`);
    console.log(`  Color Harmony:    ${s.colorHarmony}/10`);
    console.log(`  Visual Hierarchy: ${s.visualHierarchy}/10`);
    console.log(`  Polish:           ${s.polish}/10`);
    console.log(`  Cohesion:         ${s.cohesion}/10`);
    console.log(`  Overall:          ${s.overall}/10`);
    if (s.strengths.length > 0) {
      console.log(`\n  Strengths:`);
      s.strengths.forEach(str => console.log(`    + ${str}`));
    }
    if (s.issues.length > 0) {
      console.log(`\n  Issues:`);
      s.issues.forEach(iss => console.log(`    - ${iss}`));
    }
  }

  process.exit(result.passed ? 0 : 1);
}

main();
