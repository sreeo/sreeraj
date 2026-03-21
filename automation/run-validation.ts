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
  process.exit(0);
}

main();
