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

  // Vision quality gate
  visionModel: 'claude-sonnet-4-20250514' as const,
  visionThreshold: 6.0,
  visionMaxScreenshots: 4,
  visionEnabled: true,

  // Vision feedback loop
  maxVisionPasses: 3,
  visionFeedbackEnabled: true,

  // Archive
  maxArchiveMonths: 24,

  // Layout QA & fix stage
  layoutQa: {
    // Model the Agent SDK fixer runs as. Current IDs (not the dated legacy ones).
    fixerModel: 'claude-sonnet-4-6' as const,
    maxFixPasses: 3,
    // Per-pass turn budget for the SDK agent.
    fixerMaxTurns: 30,
    // Webwright agentic visual review (the "vision" half). Non-blocking:
    // if webwright isn't installed or errors, the stage continues on geometry.
    webwrightEnabled: true,
    webwrightModel: 'claude-sonnet-4-6' as const,
    // Pages the webwright reviewer inspects (a subset — it's slower than geometry).
    webwrightPages: ['/', '/treks/'],
  },
} as const;
