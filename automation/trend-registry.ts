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

  // ── Historical eras ────────────────────────────────────────────────
  {
    id: 'art-nouveau',
    name: 'Art Nouveau',
    description: 'The whiplash-curve movement of 1890-1910. Organic, botanical ornament as structure — Alphonse Mucha posters, Hector Guimard Métro entrances, Vienna Secession. Nature-derived line-work framing every composition.',
    structure: 'Content framed inside ornamental borders with curved corners drawn from vines and stems. Asymmetric flowing layouts where dividers are drawn tendrils (SVG), not straight rules. Cards as decorative panels with arched tops. A botanical/organic SVG motif system reused throughout.',
    typography: 'Flowing display serif with character for headings (suggest a Google font like Cormorant or Playfair with swashy feel); readable serif body. Titles integrated into ornament. Hand-drawn-feeling drop caps. Curved or arced text accents where tasteful.',
    spacing: 'Generous, garden-like breathing room inside ornamental frames. Margins shaped by the ornament. Vertical rhythm follows the artwork rather than a strict grid.',
    interactions: 'Vines that draw themselves in on scroll (SVG stroke-dashoffset). Slow, organic easing (600ms, ease-in-out). Hover states that bloom — subtle ornament reveals. Nothing mechanical.',
    references: 'Mucha posters, Paris Métro signage, Vienna Secession exhibition posters, William Morris patterns',
  },
  {
    id: 'constructivism',
    name: 'Russian Constructivism',
    description: 'Agitprop graphic design of the 1920s — Rodchenko, El Lissitzky. Diagonal compositions, photomontage, bold red/black/cream, type as a shouting machine. Raw revolutionary energy with rigorous geometry.',
    structure: 'Diagonal axis compositions — hero content rotated or clipped along angles (clip-path). Big geometric wedges and bars as structural elements. Asymmetric blocks colliding deliberately. Photos treated as high-contrast montage elements. Angled section dividers.',
    typography: 'Condensed, heavy, uppercase display type at poster scale. Type set on angles for emphasis. Stark size jumps. Body text in clean sans, tight and functional. Cyrillic-poster energy without being illegible.',
    spacing: 'Dense and dynamic — tension over comfort. Tight packing inside compositions, then dramatic empty zones. Spacing creates diagonal movement across the page.',
    interactions: 'Hard entrance animations along diagonals. Elements that slide in on angled paths. High-contrast hover inversions (cream→red). Fast, mechanical timing (150-250ms).',
    references: 'El Lissitzky "Beat the Whites with the Red Wedge", Rodchenko posters, Stenberg brothers film posters',
  },
  {
    id: 'de-stijl',
    name: 'De Stijl / Neoplasticism',
    description: 'Mondrian and Rietveld\'s reduction of design to primary colors, black lines, and rectangles. The page as an abstract composition of pure horizontal/vertical relationships.',
    structure: 'Visible thick black grid lines (4-8px) dividing the page into asymmetric rectangular zones. A few zones filled with primary red/blue/yellow; most white. Content lives inside the composition\'s cells. Navigation as one painted zone. No curves anywhere.',
    typography: 'Geometric sans, lowercase-friendly, functional. Headlines placed like compositional elements within cells. Strong alignment to the visible grid. Modest sizes — the grid is the drama, not the type.',
    spacing: 'Cells sized by golden-feeling asymmetric ratios, not equal columns. Padding inside cells is consistent and calm. The black lines ARE the spacing system.',
    interactions: 'Cells that fill with primary color on hover. Grid lines that extend/draw on scroll. Instant or short transitions — mechanical purity. A composition that subtly rearranges between pages.',
    references: 'Mondrian Composition series, Rietveld Schröder House, Theo van Doesburg typography',
  },
  {
    id: 'psychedelic-poster',
    name: 'Psychedelic Concert Poster',
    description: '1960s Fillmore/Avalon ballroom posters — Wes Wilson, Victor Moscoso. Melting type, vibrating complementary colors, art-nouveau-on-acid. Maximalist, optical, unmistakable.',
    structure: 'Poster-like hero where type and ornament merge into one artwork (SVG). Wavy, liquid section boundaries (border-radius abuse / SVG waves). Content panels shaped like poster frames. A kaleidoscopic or radial motif anchoring the homepage.',
    typography: 'Display type that bends and flows — SVG text on paths, or heavily-styled variable font settings for the hero only. Body text stays clean and readable (the trip is in the display layer). Wide, groovy letterforms for labels.',
    spacing: 'Full-bleed poster sections alternating with calm reading zones. The contrast between dense visual sections and quiet text sections is the rhythm.',
    interactions: 'Slow hue-rotate ambient shifts (respecting reduced-motion). Liquid hover distortions on display elements. Colors that vibrate at boundaries by design. Scroll-driven warping of the hero artwork.',
    references: 'Wes Wilson Fillmore posters, Victor Moscoso Neon Rose, Milton Glaser\'s Dylan poster, Yellow Submarine',
  },
  {
    id: 'memphis-design',
    name: 'Memphis / Postmodern',
    description: 'The Memphis Group\'s 1980s rebellion — Sottsass, Nathalie du Pasquier. Squiggles, terrazzo, clashing pastels with brights, playful geometry stacked with intent. Anti-minimalism executed with total confidence.',
    structure: 'Layered compositions — cards stacked at slight offsets with patterned drop-zones behind them. Terrazzo/confetti/squiggle pattern fills (CSS/SVG) on section backgrounds. Mixed shapes: circles, zigzags, columns. Playful but on a real grid underneath.',
    typography: 'Chunky geometric display with personality; clean body. Heading colors rotate through the palette. Occasional outlined (stroke-only) display text. Labels in bold caps on colored chips.',
    spacing: 'Generous enough for the patterns to read. Deliberate overlaps between elements. Sections separated by pattern-band dividers rather than rules.',
    interactions: 'Bouncy, toy-like hovers (slight rotation, scale, shadow pop). Squiggles that wiggle on hover. Staggered confetti-like entrances. Springy cubic-bezier timing with overshoot.',
    references: 'Ettore Sottsass Carlton bookcase, Nathalie du Pasquier patterns, 1980s MTV idents, Saved by the Bell titles (refined)',
  },
  {
    id: 'victorian-print',
    name: 'Victorian Almanac & Print Ephemera',
    description: '19th-century almanacs, broadsides, and patent-medicine ads. Ornate rule-work, engraved illustrations, a dozen typefaces used with strange confidence, pointing-hand manicules. Antique but information-dense.',
    structure: 'Centered, symmetric column composition framed by stacked ornamental rules. Section headers as engraved-style banners. Content organized like almanac entries — numbered, ruled, annotated. Manicules (☞) and fleurons (❦) as functional markers. Border-box frames everywhere.',
    typography: 'Exuberant mixing: slab display, condensed caps, italic script accents, small caps — deliberately many styles, hierarchically organized. Body in a sturdy old-style serif. Ornamented drop caps. ALL-CAPS proclamation headers with decorative underlines.',
    spacing: 'Dense like a printed page that cost money per inch. Tight leading in lists, generous ceremonial space around banners. Rules and ornaments carry the rhythm.',
    interactions: 'Nearly none — dignified. Ink-spread hover on links (slight weight/letter-spacing shift). Sepia-toned transitions. A subtle paper-grain texture layer.',
    references: 'Old Farmer\'s Almanac, Victorian broadsides, Barnum circus posters, patent medicine labels, engraved stock certificates',
  },

  // ── Non-web media, translated ──────────────────────────────────────
  {
    id: 'cartographic',
    name: 'Cartographic / Field Atlas',
    description: 'The design language of topographic maps and expedition atlases — contour lines, coordinates, legends, compass roses, survey annotations. A natural fit for a site that is half trek journal.',
    structure: 'A faint contour-line or graticule background layer (generative SVG). Content panels as map insets with coordinate-labeled corners. A legend-style navigation box. Post listings as a gazetteer — grid-referenced entries. Scale bars and north arrows as functional decoration.',
    typography: 'Classic map lettering hierarchy: small caps with wide tracking for regions/labels, italic serif for water-feature-style accents, compact sans for annotations. Coordinates and elevations in tabular monospace.',
    spacing: 'Precise, surveyed spacing — hairline rules, small ticks, margin scales along the page edges. Dense annotation zones vs open "terrain" zones.',
    interactions: 'Contour lines that draw on scroll. Panels that pin like map markers. Hover reveals annotation callouts (like map tooltips). Route lines animating between points on the trek pages.',
    references: 'USGS topographic quads, Swisstopo maps, Ordnance Survey, National Geographic expedition maps, Tufte\'s cartography chapters',
  },
  {
    id: 'blueprint-schematic',
    name: 'Blueprint / Technical Schematic',
    description: 'Cyanotype engineering drawings and drafting-room culture. White line-work on Prussian blue, dimension lines, title blocks, revision tables. The site as a set of construction documents.',
    structure: 'Deep blueprint-blue ground with white/cyan line-work. Every section framed with a drafting title block (project, sheet number, date, revision). Dimension lines with arrowheads annotating real measurements of the layout. Cross-hatched zones. An exploded-diagram hero.',
    typography: 'Drafting lettering: uppercase, evenly-spaced sans (or a drafting-style Google font) for labels; monospace for data. Sheet-number folios. Underlined section titles like drawing callouts.',
    spacing: 'Grid-paper regularity — everything aligns to a fine visible grid. Margins ruled like a drawing border. Consistent annotation offsets.',
    interactions: 'Lines that draft themselves in on scroll. Hover turns a panel from line-work to "rendered" (subtle fill). Measurement callouts appearing on hover. Crisp, instrument-like timing.',
    references: 'Original cyanotype blueprints, NASA Apollo schematics, patent drawings, Leonardo\'s notebooks (inverted), drafting title blocks',
  },
  {
    id: 'zine-punk',
    name: 'Xerox Zine / Punk Collage',
    description: 'Photocopied cut-and-paste zine culture — torn paper edges, tape, stamped and typewritten text, high-contrast halftone photos. DIY urgency crafted with modern precision.',
    structure: 'Collage layouts: content blocks as taped-on paper scraps with slight rotations (1-3deg). Torn-edge clip-paths. Halftone-treated images. Rubber-stamp labels. Layouts that feel hand-assembled but grid-disciplined underneath.',
    typography: 'Typewriter monospace body. Headlines as ransom-note mixed type or marker-scrawl display (one characterful Google font). Stamped/stenciled category labels. Underlines that look hand-drawn (SVG).',
    spacing: 'Irregular by design — overlaps, crooked margins — but readable columns underneath. Dense flyers vs sparse manifesto pages.',
    interactions: 'Paper-scrap hovers (lift + shadow + slight straighten). Stamps that thunk in on scroll. Instant, rough transitions. A photocopier-flash page transition would be a signature move.',
    references: 'Sniffin\' Glue zine, Riot Grrrl zines, Jamie Reid\'s Sex Pistols art, David Carson\'s Ray Gun (the readable parts)',
  },
  {
    id: 'risograph',
    name: 'Risograph Print',
    description: 'The riso duplicator aesthetic beloved by small-press studios: 2-3 fluorescent spot colors, visible grain, slight misregistration, overprint blends. Warm, tactile, imperfect-on-purpose.',
    structure: 'Flat spot-color shapes composing the layout — no gradients except riso-style grain dithers. Overlapping color blocks producing a third blend color (multiply blend-mode). Misregistered outlines (offset 2-3px). Poster-like section compositions.',
    typography: 'Friendly geometric or grotesque display in solid spot colors, sometimes overprinted. Body text in near-black riso "ink". Slight print-wobble acceptable on display only.',
    spacing: 'Print-poster margins, generous gutters. Compositions breathe like a well-laid-out riso spread. Consistent bleed-like edge behavior.',
    interactions: 'Layers that print-in on scroll (color separations arriving one at a time — a perfect signature animation). Hover shifts registration slightly. Grain texture overlay via SVG noise.',
    references: 'Risotto Studio prints, People of Print riso zines, Lucky Riso, stack magazines\' riso covers',
  },
  {
    id: 'transit-system',
    name: 'Transit System / Timetable',
    description: 'The information design of metro maps and railway timetables — Beck\'s tube map, Vignelli\'s subway diagram, Swiss rail departure boards. Lines, interchanges, and schedules as the entire visual language.',
    structure: 'Posts as stations on colored metro lines (SVG diagram) — categories are lines, the homepage is the network map. 45-degree-angle route geometry. Timetable-style listings with departure-board rows. Station-signage headers with line-color chips and roundels.',
    typography: 'Transit sans (Inter is fine) at signage weights. White-on-line-color station name bars. Tabular figures for all times/dates. Terse, wayfinding-style labels — no decorative copy.',
    spacing: 'Signage spacing: bold, consistent padding in name bars; diagram whitespace like a well-set network map; timetable rows compact and scannable.',
    interactions: 'Route lines drawing between stations on scroll. A "train" dot traveling the line as scroll progress. Departure-board flip animations (staggered letter flips) for headings. Interchange hover states.',
    references: 'Harry Beck London Underground map, Vignelli NYC subway diagram, SBB departure boards and Helvetica signage, Tokyo Metro signage',
  },

  // ── Digital-native / subcultures ───────────────────────────────────
  {
    id: 'y2k-frutiger-aero',
    name: 'Y2K / Frutiger Aero',
    description: 'The techno-optimist gloss of 1999-2007: aqua bubbles, glossy buttons, lens flares, skeuomorphic sheen, nature-meets-technology imagery. The future as it looked before flat design.',
    structure: 'Floating glossy panels with specular highlights over an airy sky/aqua gradient world. Bubble and orb motifs (pure CSS gradients). Pill-shaped glossy nav. Sections as rounded "device screens". A shimmering hero with layered translucency.',
    typography: 'Humanist sans (Frutiger-adjacent — Inter works) with soft confidence. Slight gradients or sheen on display text. Friendly rounded labels. Clean body on light panels.',
    spacing: 'Airy and floaty — panels hover with room around them. Rounded radii everywhere (12-24px). Comfortable, optimistic padding.',
    interactions: 'Glossy hover glints (a moving specular sweep). Bubbles that drift ambiently. Soft springy transitions. Aurora/gradient background slowly shifting. Everything feels like 2004\'s dream of 2020.',
    references: 'Windows Vista Aero, iMac G4-era Apple, Nokia N-series UI, mid-2000s Sony ads, frutiger-aero archives',
  },
  {
    id: 'cassette-futurism',
    name: 'Cassette Futurism',
    description: 'The retro-future of the 1970s-80s: NASA punk, CRT phosphor, chunky bezels, tactile switches, Alien\'s Nostromo and 2001\'s consoles. Analog hardware imagining the digital future.',
    structure: 'Interface as a hardware console: content panels inside bezeled frames with screws/vents (CSS detail). CRT-curved screen areas with scanline texture. Status-light strips. A boot-sequence hero. Chunky segmented controls as navigation.',
    typography: 'Phosphor-glow monospace for data (amber or green on near-black), Eurostile-flavored wide display caps for panel labels (a wide Google font), small utilitarian sans for annotations.',
    spacing: 'Panel-gasket spacing — consistent bezels between modules. Dense instrument clusters vs large single-purpose displays. Everything feels bolted down.',
    interactions: 'CRT flicker-on for panels entering view. Typing/teletype reveals. Indicator LEDs that blink with status. Switch-flip hovers with instant mechanical response. Subtle scanline shimmer (reduced-motion safe).',
    references: 'Nostromo interfaces (Alien), 2001\'s HAL readouts, Braun/Wega hi-fi hardware, Teenage Engineering products, NASA mission control 1969',
  },
  {
    id: 'teletext',
    name: 'Teletext / Ceefax',
    description: 'The broadcast information pages of the 70s-90s: blocky mosaic graphics, eight colors on black, numbered pages, double-height headers. Charming constraint as a complete design system.',
    structure: 'A character-grid layout (CSS grid locked to a cell size). Page-number header bar (P100-style) as navigation — sections are numbered pages. Mosaic-block dividers and illustrations built from grid cells. Double-height section headers. A "page rotation" concept for featured posts.',
    typography: 'Monospace throughout, bitmap-flavored. Double-height/double-width display via transform for headers. The classic teletext palette (white/yellow/cyan/green/magenta/red/blue on black) used systematically for hierarchy.',
    spacing: 'Strict character-cell rhythm — every gap is n cells. Dense, broadcast-information layout. No fractional spacing anywhere.',
    interactions: 'Page-load "reveal" that paints in rows like a teletext refresh. Number-key navigation hints. Blinking cursor accents. Hover inverts cell colors. All timing stepped, not eased.',
    references: 'BBC Ceefax, ORF Teletext (still live), Minitel screens, teletext art by Dan Farrimond',
  },
  {
    id: 'demoscene-ascii',
    name: 'Demoscene / ASCII Art',
    description: 'The BBS and demoscene underground: ANSI/ASCII art, character-grid graphics, scrollers, cracktro energy. Code as the medium and the decoration at once.',
    structure: 'ASCII-art masthead (generated, not an image). Content in character-bordered boxes (single/double box-drawing). An animated ASCII shader background at low opacity (canvas rendering characters). NFO-file styling for metadata blocks. Group-credits footer like a cracktro.',
    typography: 'Monospace everything, multiple sizes allowed. Headers as figlet-style ASCII banners. Box-drawing characters as the border system. Syntax-highlight-inspired accent colors on dark.',
    spacing: 'Character-grid spacing. Boxes padded in whole characters. Dense, terminal-like but composed with real hierarchy.',
    interactions: 'A sine-wave text scroller somewhere (subtle, reduced-motion safe). ASCII fire/plasma/starfield background effect in canvas. Typing reveals. Hover fills box borders from single to double lines.',
    references: 'ANSI art packs (ACiD, iCE), keygen/cracktro screens, asciimatics demos, textmode.art, 16colo.rs archive',
  },
  {
    id: 'generative-art-first',
    name: 'Generative Art-First',
    description: 'The design built around a living generative system — flow fields, L-systems, reaction-diffusion, Perlin landscapes. The rest of the page is gallery-quiet so the algorithm is the identity.',
    structure: 'A prominent living generative canvas as the hero and recurring motif (seeded per-page so each page has its own variation). Content in austere gallery panels — maximum restraint around the artwork. Plotter-style generative dividers between sections. Each post card carries a small unique generative thumbnail derived from its slug hash.',
    typography: 'Neutral, refined sans at modest sizes — museum-label typography. Titles small and confident, not shouting. Monospace for the "seed" and algorithm annotations displayed as functional art credits.',
    spacing: 'Gallery spacing: vast, deliberate, symmetric around artworks. The emptiness frames the algorithm.',
    interactions: 'The generative system responds gently to pointer and scroll (attraction/repulsion in the field). Per-visit seed variation. Pause/play respect for reduced-motion. Everything else nearly static.',
    references: 'Tyler Hobbs\' Fidenza, Vera Molnár plotter works, Zach Lieberman sketches, generated.space, Matt DesLauriers',
  },
];

// Category map — which creative territory each trend belongs to. Used by the
// month rotation in pick-trend.ts so consecutive months pull from different
// territories (new/current ↔ historical ↔ translated media ↔ digital-native).
export type TrendCategory = 'contemporary' | 'era' | 'medium' | 'digital';

const TREND_CATEGORY: Record<string, TrendCategory> = {
  // contemporary / current-web
  'apple-minimal': 'contemporary', 'glassmorphism': 'contemporary', 'neo-grotesque': 'contemporary',
  'parallax-storytelling': 'contemporary', 'bento-grid': 'contemporary', 'neubrutalism': 'contemporary',
  'scandinavian': 'contemporary', 'motion-first': 'contemporary', 'japanese-minimal': 'contemporary',
  // historical eras & movements
  'swiss-international': 'era', 'bauhaus': 'era', 'art-deco': 'era', 'mid-century-modern': 'era',
  'art-nouveau': 'era', 'constructivism': 'era', 'de-stijl': 'era', 'psychedelic-poster': 'era',
  'memphis-design': 'era', 'victorian-print': 'era',
  // non-web media translated to the web
  'editorial-magazine': 'medium', 'newspaper-classic': 'medium', 'dark-academia': 'medium',
  'cartographic': 'medium', 'blueprint-schematic': 'medium', 'zine-punk': 'medium',
  'risograph': 'medium', 'transit-system': 'medium',
  // digital-native subcultures
  'brutalist-web': 'digital', 'terminal-hacker': 'digital', 'dashboard-data': 'digital',
  'retro-web': 'digital', 'y2k-frutiger-aero': 'digital', 'cassette-futurism': 'digital',
  'teletext': 'digital', 'demoscene-ascii': 'digital', 'generative-art-first': 'digital',
};

export function categoryOf(trend: DesignTrend): TrendCategory {
  return TREND_CATEGORY[trend.id] ?? 'contemporary';
}

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

export function selectTrend(designLog: DesignLog, category?: TrendCategory): DesignTrend {
  const now = new Date();
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Trends used in the last 12 months. Cron-produced log entries carry
  // trendId 'full-rebuild', so match on trendName containment as well —
  // otherwise recency-avoidance silently never applies to real runs.
  const recent = designLog.designs.filter(
    d => d.status === 'success' && new Date(d.timestamp) > twelveMonthsAgo,
  );
  const recentIds = new Set(recent.map(d => d.trendId));
  const recentNames = recent.map(d => (d.trendName || '').toLowerCase());
  // Near-duplicate guard: sharing any significant word with a recent design
  // counts as recently used ("Terminal / Hacker" vs "Cutting-Edge Terminal").
  const STOP = new Set(['design', 'style', 'styles', 'modern', 'classic', 'contemporary', 'revival', 'international']);
  const sigWords = (s: string) =>
    s.toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 5 && !STOP.has(w));
  const recentWords = new Set(recentNames.flatMap(sigWords));
  const usedRecently = (t: DesignTrend) =>
    recentIds.has(t.id) ||
    recentNames.some(n => n.includes(t.name.toLowerCase())) ||
    sigWords(t.name).some(w => recentWords.has(w));

  // Progressive filtering: category + fresh → category → fresh → all.
  const inCategory = category ? TRENDS.filter(t => categoryOf(t) === category) : TRENDS;
  const pool =
    inCategory.filter(t => !usedRecently(t)).length > 0
      ? inCategory.filter(t => !usedRecently(t))
      : TRENDS.filter(t => !usedRecently(t)).length > 0
        ? TRENDS.filter(t => !usedRecently(t))
        : TRENDS;

  return pool[Math.floor(Math.random() * pool.length)];
}

export function getLastTrend(designLog: DesignLog): string | null {
  const successful = designLog.designs.filter(d => d.status === 'success');
  if (successful.length === 0) return null;
  return successful[successful.length - 1].trendName;
}
