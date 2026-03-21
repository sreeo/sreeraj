export interface DesignTrend {
  id: string;
  name: string;
  description: string;
  structure: string;
  typography: string;
  spacing: string;
  interactions: string;
  references: string;
}

export const TRENDS: DesignTrend[] = [
  {
    id: 'swiss-international',
    name: 'Swiss International Style',
    description: 'The gold standard of graphic design. Mathematical grid systems, asymmetric layouts with perfect balance, objective typography. Think Josef Müller-Brockmann, Massimo Vignelli.',
    structure: 'Strict 12-column grid with content asymmetrically placed. Strong horizontal rules as dividers. Left-aligned everything. Generous negative space used as a design element. No decorative elements — structure IS the decoration.',
    typography: 'Sans-serif only (Inter). Extreme size contrast between headings (3-4rem) and body (1rem). Bold weight for headings, regular for body. Tight line-height on headings (1.1), generous on body (1.8). Wide letter-spacing on uppercase labels.',
    spacing: 'Mathematical spacing scale — every margin and padding is a multiple of 8px. Consistent gutters. Large top margins on sections (6-8rem). Compact card padding.',
    interactions: 'Minimal. Precise underline animations on links. Clean color transitions on hover. No bouncing, no scaling — just color and opacity shifts. Everything feels deliberate and mechanical.',
    references: 'helveticafilm.com, the New York subway signage system, Braun product design, Dieter Rams',
  },
  {
    id: 'editorial-magazine',
    name: 'Editorial / Magazine Layout',
    description: 'Large-format editorial design inspired by print magazines like Bloomberg Businessweek, Monocle, The New York Times Magazine. Dramatic typography, pull quotes, multi-column layouts.',
    structure: 'Mixed column widths — some sections full-width, others split into 2-3 columns. Pull quotes break out of the main column. Large hero images with text overlays. Section breaks with bold typographic dividers. Cards feel like magazine spreads.',
    typography: 'Strong serif/sans pairing — Lora for display headings, Inter for body. Drop caps on article openings. Dramatic size contrast (5rem headings). Italic for emphasis and bylines. Small caps for categories and dates.',
    spacing: 'Print-inspired margins — wide outer margins, tight inner gutters. Generous whitespace above headings. Tight leading on large display text. Breathing room between sections.',
    interactions: 'Subtle parallax-like scroll effects on images. Smooth content reveals on scroll. Hover states that feel editorial — underlines that draw in, images that slightly zoom. Page-turn feel to transitions.',
    references: 'Bloomberg Businessweek, Monocle magazine, NYT Magazine, Medium.com early design, The Intercept',
  },
  {
    id: 'bauhaus',
    name: 'Bauhaus',
    description: 'The original modern design movement. Primary colors used sparingly as accents. Geometric shapes as structural elements. Form follows function with zero ornamentation.',
    structure: 'Geometric grid with circles, rectangles, and triangles used as layout elements. Asymmetric but balanced compositions. Cards with visible geometric borders. Section dividers using primary-colored lines or shapes. Navigation as a geometric composition.',
    typography: 'Geometric sans-serif (Inter or suggest Futura-like). Uniform weight, clean forms. Headlines in all-uppercase with wide tracking. Body text clean and functional. Typography used as geometric elements themselves.',
    spacing: 'Precise geometric spacing. Even gutters. Padding that follows the geometric proportions of the layout. White space is intentional and structural.',
    interactions: 'Geometric transitions — elements that rotate, slide, or scale in geometric patterns. Hover states that reveal geometric shapes. Clean, mechanical timing functions (linear or stepped).',
    references: 'Bauhaus Dessau website, Herbert Bayer posters, Wassily Kandinsky compositions, László Moholy-Nagy photography',
  },
  {
    id: 'brutalist-web',
    name: 'Brutalist Web Design',
    description: 'Raw, honest, no-nonsense web design that celebrates the medium. Visible structure, system fonts aesthetic, monospace layouts. Not ugly-on-purpose — intentionally raw and functional, like early web but with modern craft.',
    structure: 'Single-column layouts with hard edges. Thick 2-3px borders on everything. No border-radius. Cards are simple bordered boxes. Navigation is a plain list. Content hierarchy through size and weight alone, not color or decoration. Visible grid lines.',
    typography: 'Monospace-heavy (JetBrains Mono for UI, Inter for body). Large bold headings with no letter-spacing tricks. Raw, unstyled feel — the font does the work. Timestamps and metadata in small monospace.',
    spacing: 'Tight, efficient spacing. Small padding, compact layouts. Dense information display. Minimal whitespace — every pixel earns its place. Line-height tight on UI elements.',
    interactions: 'Hard, instant state changes — no easing, no transitions or very fast ones (50ms). Hover states that invert colors or add thick underlines. Clicks feel immediate. No smooth scrolling.',
    references: 'brutalistwebsites.com, Craigslist, Drudge Report (but refined), Bloomberg Terminal UI, HN',
  },
  {
    id: 'apple-minimal',
    name: 'Apple Minimal',
    description: 'The Apple.com school of design. Extreme whitespace, ultra-refined typography, subtle shadows, and obsessive attention to detail. Every pixel is considered. Nothing is accidental.',
    structure: 'Centered single-column with very wide margins. Cards with subtle shadows (no borders). Large hero sections with single focal points. Generous vertical spacing between sections. Content floats in space with room to breathe.',
    typography: 'Clean sans-serif (Inter) with SF Pro-like weight usage. Very specific size scale — large headings (2.5-3rem) with -0.03em tracking, medium subheads, small body. Font-weight 600 for headings, 400 for body. Subtle gray hierarchy.',
    spacing: 'Extreme whitespace. Section padding of 8-12rem. Card padding of 2-3rem. Everything has room to breathe. The spacing itself communicates premium quality. Tight letter-spacing on headings, generous line-height on body.',
    interactions: 'Buttery smooth. 300ms ease-out transitions on everything. Cards that lift with subtle shadow changes on hover. Smooth scroll behavior. Fade-in on scroll. Everything feels fluid and weightless.',
    references: 'apple.com, Linear.app, Vercel.com, Raycast.com, Nothing phone website',
  },
  {
    id: 'newspaper-classic',
    name: 'Newspaper / Broadsheet',
    description: 'Classic newspaper layout adapted for the web. Multi-column grids, serif typography, rules between columns, dateline headers. Authoritative and information-dense.',
    structure: 'Multi-column grid (2-3 columns for post listings). Thin 1px rules between columns and sections. Masthead-style header. Cards arranged like newspaper stories — lead story large, secondary stories smaller. Above-the-fold thinking.',
    typography: 'Serif-dominant (Lora for headlines and body). Classic newspaper sizing — large headlines (2.5rem+), compact body text (0.9375rem). Italic for bylines and datelines. Small caps for section headers. Justified text optional.',
    spacing: 'Tight, information-dense. Small gutters between columns. Compact vertical spacing. Dense but organized — like a real newspaper page. Margins serve as column guides.',
    interactions: 'Understated. Simple underline links (text-decoration). Minimal hover effects — slight color shifts. No animations that would feel out of place in a news context. Dignified and restrained.',
    references: 'nytimes.com, ft.com, The Guardian, washingtonpost.com, old-school blog designs',
  },
  {
    id: 'terminal-hacker',
    name: 'Terminal / Hacker',
    description: 'Full terminal emulator aesthetic. Everything looks like it runs in a TTY. Monospace everything, command-line prompts, green-on-black or amber-on-black. But well-crafted and readable.',
    structure: 'Single-column, fixed-width container (like a terminal window). Optional terminal chrome (title bar with dots). Content presented as command output. Cards as bordered terminal panes. Navigation as a command menu. ASCII art dividers.',
    typography: 'Monospace only (JetBrains Mono). Single font size for body with hierarchy through color and prefixes (>, #, $). Headings differentiated by ASCII decoration or prefix characters, not font size. Fixed-width everything.',
    spacing: 'Line-based spacing — everything aligns to a character grid. Padding in character units. Consistent line-height throughout. Dense, terminal-like information display.',
    interactions: 'Typewriter text reveals. Cursor blink animations. Command-line style input animations. Matrix-like character rain (subtle). Hover states that highlight lines like terminal selection.',
    references: 'Cool Retro Term, Hyper terminal, GitHub CLI output, ttyd, blessed terminal UI',
  },
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    description: 'Frosted glass UI with depth and layering. Background blur effects, translucent surfaces, subtle borders. The design language of macOS/iOS, Windows 11, and modern dashboards.',
    structure: 'Layered cards with backdrop-filter blur on semi-transparent backgrounds. Subtle 1px borders with rgba colors. Cards float over a gradient or image background. Depth through layering, not shadows. Navigation bar with glass effect.',
    typography: 'Clean sans-serif (Inter). Medium weight (500) for most text. Clear hierarchy through size, not weight. Text must be highly readable against the frosted backgrounds — use text-shadow or ensure sufficient contrast.',
    spacing: 'Generous padding inside glass cards (1.5-2rem). Comfortable gaps between cards. Rounded corners (0.75-1rem). Airy, spacious feel within each glass panel.',
    interactions: 'Smooth backdrop-filter transitions. Cards that subtly shift blur intensity on hover. Gentle scale transforms (1.01-1.02). Glass panels that slide or fade in. Border opacity changes on interaction.',
    references: 'macOS Ventura UI, Windows 11 Mica/Acrylic, glassmorphism.com, Apple Music, Linear app',
  },
  {
    id: 'neo-grotesque',
    name: 'Neo-Grotesque / Contemporary',
    description: 'The dominant web design style of 2024-2026. Large type, scrolling animations, horizontal rules, sticky elements, and tasteful minimalism. Think top-tier portfolio and agency sites.',
    structure: 'Full-width sections with alternating backgrounds. Horizontal rules as major dividers. Sticky navigation that transforms on scroll. Large section headings that span the full width. Cards in clean grids with generous gaps. Footer as a design element.',
    typography: 'Large, confident sans-serif. Hero text at 4-6rem with tight tracking (-0.04em). Body at 1.125rem with comfortable line-height (1.7). Weight 300 for large display, 400 for body, 600 for emphasis. Numbers in tabular figures.',
    spacing: 'Very large vertical rhythm — 6-10rem between sections. Cards with 2rem+ padding. Wide horizontal padding on desktop. The spacing says "we have nothing to prove, we just let content breathe."',
    interactions: 'Smooth scroll-triggered animations (fade up, slide in). Magnetic hover effects on links. Text links with animated underlines (clip-path or scaleX). 400ms ease-out timing. Scroll progress indicators.',
    references: 'stripe.com, linear.app, vercel.com, loom.com, notion.so marketing pages, Pentagram.com',
  },
  {
    id: 'japanese-minimal',
    name: 'Japanese Minimalism',
    description: 'Wabi-sabi meets digital design. Asymmetric balance, natural texture references, deliberate imperfection, extreme restraint. Inspired by Japanese graphic design and architecture.',
    structure: 'Asymmetric layouts with intentional imbalance. Large empty space as a primary design element (ma — negative space). Cards with minimal borders, separated by space alone. Off-center headings. Single-column with wide margins on one side.',
    typography: 'Extreme restraint — one font weight for body, one for headings. Very small body text (0.9375rem) with generous line-height (2.0). Headings understated, not shouting. Uppercase labels with very wide letter-spacing (0.2em).',
    spacing: 'Asymmetric margins. Very generous vertical space (8-12rem between sections). Tight horizontal spacing within elements. The emptiness is the design — ma (間) concept.',
    interactions: 'Extremely subtle. Barely-there hover states (5% opacity change). Slow, deliberate transitions (500-800ms). Fade effects only. Nothing sudden or attention-grabbing. Interactions feel like breathing.',
    references: 'muji.com, Kenya Hara designs, Naoto Fukasawa products, teamLab website, Japanese railway signage',
  },
  {
    id: 'art-deco',
    name: 'Art Deco',
    description: 'The roaring 20s design language. Geometric symmetry, gold accents on dark backgrounds, ornamental borders, luxury typography. Gatsby-era opulence meets modern web.',
    structure: 'Symmetrical, centered layouts. Geometric border patterns (chevrons, fans, stepped lines) as section dividers. Cards with decorative corner elements. Navigation centered with decorative separators. Content framed in geometric containers.',
    typography: 'Geometric serif or display fonts for headings. All-caps with very wide letter-spacing (0.15-0.3em) for labels. Clean sans-serif for body. Gold-colored headings on dark backgrounds. Tiered heading hierarchy with decorative rules.',
    spacing: 'Formal, symmetrical spacing. Equal padding on all sides. Centered content with balanced margins. Decorative borders add visual rhythm. Generous space around ornamental elements.',
    interactions: 'Elegant reveals — elements that fan open or step in geometrically. Gold shimmer effects on headings (subtle gradient animation). Hover states with geometric border reveals. Timing feels grand and deliberate (400-600ms).',
    references: 'The Great Gatsby title design, Chrysler Building details, Art Deco Miami architecture, 1920s poster design',
  },
  {
    id: 'parallax-storytelling',
    name: 'Parallax Storytelling',
    description: 'Scroll-driven narrative design. Layers that move at different speeds create depth. Content reveals through scrolling. The page tells a story as you scroll through it.',
    structure: 'Full-viewport sections that transform on scroll. Sticky elements with scroll-driven transitions. Cards that enter from different directions as you scroll. Background elements that move slower than foreground (parallax). Progressive disclosure of content.',
    typography: 'Large display headings that fade/transform on scroll. Clean readable body text. Contrast between fixed background text and scrolling content. Section titles that stick and shrink.',
    spacing: 'Full-height sections (100vh or near). Generous padding within sections. Content centered with wide margins. Space between sections is the scroll journey itself.',
    interactions: 'Scroll-driven animations using CSS animation-timeline: scroll(). Parallax layers via transform with scroll progress. Elements that fade, scale, and translate as user scrolls. Smooth, physics-based feeling. Intersection Observer reveals.',
    references: 'Apple product pages (iPhone, Mac), Stripe annual letters, Bloomberg visual stories, Awwwards parallax category',
  },
  {
    id: 'bento-grid',
    name: 'Bento Grid',
    description: 'Apple-popularized modular grid where content is organized into varied-size tiles like a Japanese bento box. Clean, organized, each cell is self-contained. Modern dashboard aesthetic.',
    structure: 'CSS Grid with mixed cell sizes — some 1x1, some 2x1, some 1x2. Consistent gap between all cells. Each cell is a self-contained content unit with its own visual hierarchy. Rounded corners on cells. The grid IS the layout — no other structural elements needed.',
    typography: 'Clean sans-serif. Each cell has its own typographic hierarchy (label, value, detail). Small labels in uppercase. Large featured numbers or titles. Compact but readable within each cell.',
    spacing: 'Consistent gap between grid cells (1-1.5rem). Internal cell padding (1.25-1.5rem). The gaps create a rhythm. No extra margins outside the grid. Tight, modular, organized.',
    interactions: 'Individual cell hover effects — subtle lift, border highlight, or background shift. Staggered entrance animations (cells appear one by one). Smooth transitions within cells. Each cell feels interactive independently.',
    references: 'apple.com/apple-intelligence, Linear changelog, Vercel dashboard, iOS widgets, macOS System Settings',
  },
  {
    id: 'dark-academia',
    name: 'Dark Academia',
    description: 'Scholarly, vintage library aesthetic. Old-world intellectualism meets web design. Muted warm tones, classical serif typography, leather-and-parchment texture references.',
    structure: 'Book-inspired layout — wide margins like a printed page. Chapter-like section breaks with ornamental rules (em dashes, small decorative lines). Sidebar-style metadata. Cards that feel like index cards or book plates. Content in a single, readable column.',
    typography: 'Classical serif (Lora) for everything — headings and body. Italic for emphasis and asides. Small caps for labels and categories. Roman numerals for numbering. Old-style figures. Generous line-height for readability (1.9-2.0).',
    spacing: 'Wide page margins (like a printed book). Generous paragraph spacing. Indented first lines optional. Section breaks with decorative dividers. Space feels intentional and literary.',
    interactions: 'Understated and dignified. Serif italic on hover for links. Gentle sepia-toned transitions. Content reveals that feel like turning pages. Nothing flashy — the content is the star.',
    references: 'Penguin Books covers, Oxford University Press, old Tumblr academia aesthetic, archive.org book reader, gwern.net',
  },
  {
    id: 'neubrutalism',
    name: 'Neubrutalism',
    description: 'Modern take on brutalism — bold shadows, thick borders, bright accents on neutral backgrounds. Popularized by Figma, Gumroad, and modern SaaS. Raw but friendly, not aggressive.',
    structure: 'Cards with thick borders (2-3px black) and hard offset box-shadows (4-6px). No border-radius OR very slight (4px). Flat, no gradients. White or off-white backgrounds with single bright accent. Navigation simple and bold. Clear visual weight to interactive elements.',
    typography: 'Bold, confident sans-serif. Heavy weight (700-800) for headings. Clean body text. No decorative fonts — the borders and shadows provide the personality. Uppercase for small labels.',
    spacing: 'Comfortable but not excessive. Medium padding in cards (1.25-1.5rem). Clear gaps between elements. The thick borders and shadows need breathing room. Not as dense as classic brutalism.',
    interactions: 'Hard shadow shifts on hover (shadow moves from 4px to 2px, card appears to press down). Color fills on hover. Instant or near-instant transitions (100-150ms). Satisfying, tactile-feeling clicks.',
    references: 'Figma community, Gumroad redesign, Notion templates community, modern indie SaaS landing pages',
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian / Nordic',
    description: 'Clean, functional, warm minimalism inspired by Scandinavian design principles. Neutral tones with natural material references. Cozy yet precise. Hygge meets digital.',
    structure: 'Clean single-column or simple 2-column grid. Cards with very subtle borders or shadow (barely there). Rounded corners (0.75rem). Simple, uncluttered navigation. Content organized by clear hierarchy, not visual tricks. Warm, inviting negative space.',
    typography: 'Rounded, friendly sans-serif (Inter works perfectly). Medium weight for headings (500-600), light for body. Comfortable reading sizes. Nothing extreme — pleasant and approachable. Slightly larger body text (1.0625rem).',
    spacing: 'Generous but warm — not cold/clinical whitespace. Comfortable padding (1.5-2rem). Sections feel like rooms in a well-designed home. Natural rhythm, not mathematical precision.',
    interactions: 'Gentle, warm transitions (250-350ms ease). Soft shadow deepening on hover. Rounded elements that feel tactile. Nothing aggressive. Interactions feel like touching wood or fabric — smooth, natural, satisfying.',
    references: 'HAY furniture website, Muuto.com, IKEA.com product pages, Finnish Design Shop, Kinfolk magazine',
  },
  {
    id: 'mid-century-modern',
    name: 'Mid-Century Modern',
    description: 'Clean lines, organic curves, and bold graphic elements from the 1950s-60s design era. Think Eames, Saul Bass, and Herb Lubalin. Geometric yet warm, structured yet playful.',
    structure: 'Clean grid with occasional organic curve elements (decorative arcs, boomerang shapes). Two-tone section backgrounds. Cards with clean borders. Bold graphic elements as section dividers. Asymmetric hero layouts with geometric accents.',
    typography: 'Geometric sans-serif for headings. Clean, well-spaced body text. Bold for emphasis. Occasional display type for impact. Well-defined hierarchy through weight and size, not decoration.',
    spacing: 'Balanced, proportional spacing. Medium padding. Well-defined sections with clear breaks. The layout feels designed and intentional, like a poster composition.',
    interactions: 'Smooth, playful transitions. Elements that slide or rotate with character. Color swaps on hover. Animations that reference physical motion (like a mobile turning). Fun but controlled.',
    references: 'Eames Office website, Saul Bass title sequences, Herman Miller marketing, Charley Harper illustrations',
  },
  {
    id: 'dashboard-data',
    name: 'Dashboard / Data-Dense',
    description: 'Information-rich interface design inspired by professional dashboards, trading terminals, and data visualization tools. Dense, organized, highly functional.',
    structure: 'Multi-panel layout with sidebar-like sections. Dense card grid with small gaps. Data tables, key-value pairs, badge-style tags. Everything organized into clear panels/regions. Navigation as a sidebar or tab system. Monospace for data, sans for labels.',
    typography: 'Tabular monospace for data (JetBrains Mono). Small sans-serif for labels (Inter, 0.75rem). Compact headings. Number-heavy displays. Status indicators with colored dots. Small, dense, information-rich text.',
    spacing: 'Compact. Small padding (0.75-1rem). Tight line-heights. Dense grid with small gaps (0.5-0.75rem). Every pixel serves a purpose. Scrollable regions within fixed frames.',
    interactions: 'Functional hover states — row highlights in tables, tooltip-like info reveals. Quick transitions (100-200ms). Focus states for keyboard navigation. Status color changes. Everything feels responsive and data-driven.',
    references: 'Bloomberg Terminal, Grafana dashboards, Linear app, GitHub Insights, Datadog, Figma Dev Mode',
  },
  {
    id: 'retro-web',
    name: 'Retro Web (Web 1.0 Revival)',
    description: 'Nostalgic early-web aesthetic but with modern craft. Pixel borders, limited palette, visible page structure, web rings, hit counters, and under-construction vibes — but done well.',
    structure: 'Table-like layouts using CSS Grid. Visible borders and dividers everywhere. Sidebar + main content structure. Banner-style headers. Footer with "web ring" style links. Cards with inset/outset borders (beveled edges). Marquee-style scrolling text optional.',
    typography: 'System-font aesthetic — clean sans-serif at small sizes. Monospace for code and metadata. Pixel-font style for decorative elements. Not actually pixelated, but referencing that era. Simple, functional type.',
    spacing: 'Compact like old websites. Small margins, small padding. Dense content. The web was information-dense before whitespace became fashionable. Functional, not decorative spacing.',
    interactions: 'CSS-only hover effects that reference old web — color inversions, underlines, visited link colors. Blinking cursors (sparingly). Simple transitions. Nothing smooth — everything has a slightly mechanical quality.',
    references: 'neocities.org sites, old Geocities pages (but refined), Cameron\'s World, web.archive.org 2003-era sites, pools.xzy',
  },
  {
    id: 'motion-first',
    name: 'Motion-First Design',
    description: 'Design where animation and transitions are the primary design language. Every state change is choreographed. Inspired by iOS/Android motion design and award-winning web experiences.',
    structure: 'Standard clean grid layout — the structure is conventional so the motion can shine. Cards, sections, and navigation are well-organized. The magic is in how elements enter, exit, and transition between states.',
    typography: 'Clean sans-serif. The typography itself may animate — weight changes, tracking shifts, reveal animations. Text enters with purpose (fade up, clip reveal, typewriter). Reading experience is smooth and flowing.',
    spacing: 'Generous spacing to give animated elements room to move. Elements need space to enter from. Comfortable padding, standard gaps. The spacing supports the motion choreography.',
    interactions: 'This IS the design. Staggered entrance animations with cubic-bezier easing. Scroll-triggered reveals with animation-timeline. Micro-interactions on every interactive element. Spring physics feel (overshoot and settle). View transitions between pages. Every hover, focus, and click is choreographed.',
    references: 'stripe.com animations, linear.app transitions, Apple product page scroll effects, Framer Motion showcase, Emil Kowalski\'s animations',
  },
];

export interface DesignLogEntry {
  month: string;
  trendId: string;
  trendName: string;
  status: 'success' | 'failed';
  timestamp: string;
  description?: string;
  primaryColor?: string;
}

export interface DesignLog {
  designs: DesignLogEntry[];
}

export function selectTrend(designLog: DesignLog): DesignTrend {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Get trends used in the last 12 months
  const recentlyUsed = new Set(
    designLog.designs
      .filter(d => d.status === 'success' && new Date(d.timestamp) > twelveMonthsAgo)
      .map(d => d.trendId)
  );

  // Filter to available trends
  const available = TRENDS.filter(t => !recentlyUsed.has(t.id));

  // If all trends used recently, reset and allow all
  const pool = available.length > 0 ? available : TRENDS;

  // Weighted random selection
  const index = Math.floor(Math.random() * pool.length);
  return pool[index];
}

export function getLastTrend(designLog: DesignLog): string | null {
  const successful = designLog.designs.filter(d => d.status === 'success');
  if (successful.length === 0) return null;
  return successful[successful.length - 1].trendName;
}
