---
name: layout-qa
description: Diagnose and fix CSS layout-geometry defects (overlapping elements, viewport overflow, cramped or clipped content) in the sreeraj.dev Astro site without changing the chosen visual style. Use when a layout-report.json lists geometry violations to resolve.
---

# Layout QA

You fix **layout geometry** bugs in `src/styles/global.css` (and, only if unavoidable, the Astro components under `src/`). The visual *style* — palette, fonts, the chosen design trend — has already been decided and approved. **Your job is to make the layout sound, not to redesign it.**

## The contract you must not break

- **Do not** change color values, font families, the type scale, or the overall aesthetic.
- **Do not** delete or rename CSS classes. The build validates a class contract (`automation/prompts/css-contract.md`); removing a required selector fails the pipeline.
- **Do not** "fix" overflow by shrinking font sizes, hiding content, or adding `overflow: hidden` to mask a real overflow. Fix the actual cause.
- Both themes matter: every themed rule has `[data-theme="tech"]` and `[data-theme="trek"]` variants. A fix to one usually needs the same treatment in the other.

## How to read `layout-report.json`

Each violation has `type`, `severity`, `page`, `viewport`, `selector`, `detail`, `measurements`, and `occurrences` (how many identical instances collapsed into one — a high count means a shared root cause, fix it once at the source). Always fix the **outermost** reported element; its children overflow with it.

## Failure modes and their real fixes

**`page-overflow` / `element-overflow`** — something is wider than the viewport (usually only on mobile).
- Most common cause: a CSS grid like `grid-template-columns: repeat(auto-fill, minmax(420px, 1fr))`. On a 390px viewport the 420px minimum can't shrink, so the column overflows. Fix: `minmax(min(100%, 420px), 1fr)` or `minmax(0, 1fr)`, or add a `@media (max-width: 640px)` rule that collapses to a single column.
- Flex children that won't shrink: add `min-width: 0` to the flex item.
- Fixed `width`/`min-width` larger than small viewports: make them `max-width` instead, or wrap in a media query.
- Long unbreakable strings (URLs, code): `overflow-wrap: anywhere` on the text element.

**`overlap`** — two content blocks intersect.
- A positioned element (`position: absolute`) escaping its flow — give the parent `position: relative` and the child correct offsets, or return it to normal flow.
- Negative margins overshooting — reduce them.
- Insufficient height reserved for a preceding element (e.g. a hero) so the next block rides up — set explicit spacing/height.

**`clipped-text`** — real content is cut off (deliberate ellipsis/line-clamp is already excluded). The container is too short/narrow: let it grow, increase `max-width`, or remove the stray `overflow: hidden`.

## Workflow

1. Read `automation/test-output/layout-report.json` and group violations by root cause.
2. Read the relevant rules in `src/styles/global.css` for the reported selectors.
3. Make the **smallest** change that fixes the geometry while preserving the look. Prefer responsive rules (media queries, `min()`/`clamp()`) over hard overrides.
4. Rebuild and re-check:
   ```sh
   npm run build && cd automation && PLAYWRIGHT_CHROME_CHANNEL=${PLAYWRIGHT_CHROME_CHANNEL:-} npx tsx layout-geometry.ts
   ```
5. Repeat until high-severity violations reach zero. Never trade a style regression for a layout fix — if a fix changes the visual design, find a different fix.
