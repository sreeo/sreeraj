## CSS Class Contract

The generated CSS MUST define styles for ALL of the following CSS classes. Each class listed under "Themed" must have styles for BOTH `[data-theme="tech"]` and `[data-theme="trek"]` selectors.

### @theme Block (Required CSS Custom Properties)
```
--font-sans, --font-serif, --font-mono
--color-accent, --color-accent-hover, --color-accent-muted
--color-trek-accent, --color-trek-accent-hover, --color-trek-accent-muted
--color-trek-bg, --color-trek-surface, --color-trek-text, --color-trek-text-muted, --color-trek-border
--color-tech-bg, --color-tech-surface, --color-tech-surface-hover, --color-tech-text, --color-tech-text-muted, --color-tech-border
--color-gray-50 through --color-gray-900 (10 shades)
```

### Base Styles (theme-independent)
```
body — font-family, line-height, transitions
.prose — max-width, font-size, line-height
.git-log-timeline — font-family, font-size, line-height
.gl-entry — display flex, alignment
.gl-graph-col — color, white-space pre, flex-shrink
.gl-graph — display block
.gl-content — display flex, gap, alignment, hover state
.gl-hash — color
.gl-msg — color, hover color
.gl-tag — color, font-weight, font-size
.gl-branch-devops, .gl-branch-trek, .gl-branch-postgres, .gl-branch-programming — color each
.gl-date — color, font-size, opacity
.cursor-blink::after — blink animation
.trek-hero-wrap, .trek-hero, .trek-hero-overlay, .trek-hero-tag — hero image with overlay
.trek-journal — position relative
.trek-journal::before — left margin decorative line
```

### Themed Classes (need BOTH [data-theme="tech"] and [data-theme="trek"] variants)

#### Navigation
```
.nav-bar — background, backdrop-filter, border-bottom
.nav-brand — color, font-family, font-weight (tech: may add ::before pseudo)
.nav-link — color
.nav-link:hover, .nav-link.active — color, text-decoration
```

#### Post Cards
```
.post-card — background, border/shadow, border-radius, padding, transitions, hover state
.post-card-title — color, font-weight, hover color change
.post-card-meta — color, font-family, font-size
.post-card-description — color
.post-card-image — border-radius, opacity/object-fit
.post-card-body — padding (trek variant)
.post-card-visual — optional visual treatment
```

#### Tags
```
.tag-pill — background, color, border, font-size, hover state (invert colors)
```

#### Section Headings
```
.section-title — color, font-family, font-weight (tech: may add ::before pseudo)
```

#### Footer
```
.site-footer — background, border-top, color
.site-footer a — color, hover color
```

#### Prose / Blog Content (BOTH tech and trek variants)
```
.prose h1, h2, h3, h4 — color, font-weight, font-size, margins (tech: h2/h3 may have ::before)
.prose p — margin-bottom
.prose a — color, text-decoration, hover state
.prose strong — color
.prose img — border-radius, margin, border
.prose figure, figcaption — margin, text-align, color, font-size
.prose pre — background, border, border-radius, padding, font-size
.prose code — font-family, font-size
.prose :not(pre) > code — background, color, padding, border-radius
.prose blockquote — border-left, padding, color, font-style
.prose ul, ol — padding-left, list-style
.prose li — margin-bottom
.prose li::marker — color
.prose hr — border, margin
.prose table, th, td — width, border-collapse, border, padding
.prose th — background, font-weight
```

#### Bookmark Cards (BOTH themes)
```
.kg-bookmark-card — border, border-radius, overflow
.kg-bookmark-card a — display, padding, hover background
.kg-bookmark-title — font-weight, color
.kg-bookmark-description — font-size, color
```

#### Homepage Mixed Theme
```
[data-theme="tech"] .trek-card — background, border, border-radius, hover state
[data-theme="tech"] .trek-card .post-card-title — font-family
[data-theme="tech"] .trek-card .post-card-meta — font-family
```

#### Post Header
```
.post-header-title — color, font-weight, letter-spacing
.post-header-meta — color, font-family, font-size
.post-hero-image — border-radius, border
.post-nav-link — color, font-family, font-size, hover
.post-nav-border — border-color
```

#### Page Title
```
.page-title — color, font-family, font-weight
.page-description — color
```

#### Trek Journal Expedition Styles
```
[data-theme="trek"] .trek-prose img — polaroid styling (padding, background, box-shadow, rotation)
[data-theme="trek"] .trek-prose img:nth-child variants — alternating rotations
[data-theme="trek"] .trek-prose img:hover — transform, shadow
[data-theme="trek"] .trek-prose > p:first-of-type::first-letter — drop cap
[data-theme="trek"] .trek-prose ol — counter-reset, custom numbering
[data-theme="trek"] .trek-prose ol > li — counter-increment, left border, custom ::before
[data-theme="trek"] .trek-prose blockquote — trail marker style with ::before icon
[data-theme="trek"] .trek-prose strong — accent color
[data-theme="trek"] .trek-prose hr — mountain divider with ::before content
```

#### Canvas/WebGL Components
```
.mountain-skyline — positioning
.mountain-canvas — sizing
.flow-field-canvas — sizing, positioning
```

#### Background Visual Controls (CSS Custom Properties)
These optional CSS custom properties control the background visual components. Set them to customize or disable backgrounds:

```
--flow-field-opacity — particle field opacity (default 0.12, set to 0 to hide)
--flow-field-color — particle RGB values e.g. "34, 211, 238" (no # prefix, comma-separated RGB)
--flow-field-bg — canvas clear RGB values e.g. "15, 23, 42"
--flow-field-speed — particle speed multiplier (default 1 for tech, 0.6 for trek)
--mountain-display — "block" or "none" to show/hide mountain skyline
--mountain-height — mountain container height e.g. "180px" or "0px"
```

#### Background Effects (Optional, encouraged)
You are encouraged to add CSS-based background effects that match the design style. These layer behind the content (z-index 0-1). Ideas:
- CSS gradients on body or ::before pseudo-elements
- Repeating patterns (dots, grids, lines) via background-image
- Animated gradient backgrounds
- Noise/grain texture overlays via SVG filters
- Geometric shapes via clip-path or SVG backgrounds
- Vignette effects via radial-gradient overlays

Example: a grid background for a Swiss/Bauhaus style:
```css
body::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-image: repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 80px);
  background-size: 80px 80px;
}
```

### Responsive Breakpoints Required
- `@media (max-width: 640px)` — git log timeline adjustments
- `@media (max-width: 768px)` — trek journal margin line hidden, trek images constrained
- `@media (prefers-reduced-motion: reduce)` — disable all animations
- `@media (prefers-reduced-motion: no-preference)` — scroll-triggered trek image reveal animation
