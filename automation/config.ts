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

  // Agent providers, models and turn budgets live in pipeline/roles.json (Claude pinned to
  // claude-opus-5-5, Codex to gpt-6.1-sol; REDESIGN_CLAUDE_MODEL / REDESIGN_CODEX_MODEL override).

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
    maxFixPasses: 3,
    // Webwright agentic visual review (the "vision" half). Non-blocking:
    // if webwright isn't installed or errors, the stage continues on geometry.
    webwrightEnabled: true,
    // Webwright calls the raw API with ANTHROPIC_API_KEY, outside the subscription adapter.
    webwrightModel: 'claude-opus-5-5' as const,
    // Pages the webwright reviewer inspects (a subset — it's slower than geometry).
    webwrightPages: ['/', '/treks/'],
  },
} as const;
