import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const CONFIG = {
  // Paths
  projectRoot: path.resolve(__dirname, '..'),
  globalCssPath: path.resolve(__dirname, '..', 'src/styles/global.css'),
  archiveDir: path.resolve(__dirname, '..', 'public/archive'),
  registryPath: path.resolve(__dirname, '..', 'public/archive/registry.json'),
  designLogPath: path.resolve(__dirname, 'history/design-log.json'),
  testOutputDir: path.resolve(__dirname, 'test-output'),
  promptsDir: path.resolve(__dirname, 'prompts'),

  // Claude API
  model: 'claude-sonnet-4-20250514' as const,
  maxTokens: 16384,
  temperature: 0.8,

  // Validation
  pagesToCheck: [
    '/',
    '/about/',
    '/devops/',
    '/treks/',
    '/programming/',
    '/postgres/',
    '/contact/',
  ],
  maxRetries: 2,

  // Archive
  maxArchiveMonths: 24,
} as const;
