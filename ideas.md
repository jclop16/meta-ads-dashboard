# Meta Ads Dashboard — Design Ideas

## Response 1
<response>
<text>
**Design Movement:** Dark Data Terminal / Bloomberg-Inspired Command Center
**Core Principles:**
- Information density without clutter — every pixel earns its place
- Monochromatic dark base with electric accent pops (neon cyan/electric blue)
- Data-first hierarchy: numbers are the heroes, labels are supporting cast
- Brutal honesty in color: red = waste, green = win, no ambiguity

**Color Philosophy:** Deep charcoal background (#0D0F14) with electric cyan (#00D4FF) as the primary accent. Red (#FF3B5C) for underperformers, emerald (#00E676) for winners. The palette evokes trading terminals and command centers — serious, data-rich, authoritative.

**Layout Paradigm:** Left sidebar navigation with a fixed header showing live account totals. Main content uses a bento-grid layout where KPI cards, charts, and tables coexist in an asymmetric mosaic. No full-width centered columns.

**Signature Elements:**
- Glowing metric cards with subtle inner light effect
- Horizontal bar charts with color-coded performance bands
- Monospace font for all numbers (JetBrains Mono)

**Interaction Philosophy:** Hover states reveal delta indicators and contextual tooltips. Clicking a campaign row expands an inline detail panel.

**Animation:** Numbers count up on load. Chart bars animate left-to-right. Card entrance uses staggered fade-up.

**Typography System:** Display: Space Grotesk Bold for headings. Body: Inter 400/500. Numbers: JetBrains Mono. Hierarchy enforced through weight, not size alone.
</text>
<probability>0.07</probability>
</response>

## Response 2
<response>
<text>
**Design Movement:** Brutalist Data Journalism / NYT Graphics Department
**Core Principles:**
- Raw editorial clarity — data speaks, design supports
- Stark contrast between white space and dense data zones
- Typographic hierarchy carries all the weight
- Color used sparingly and purposefully (one accent, two semantic colors)

**Color Philosophy:** Off-white background (#F7F5F0) with near-black text (#1A1A1A). A single strong accent — deep cobalt (#1B3A8C) — for interactive elements and chart fills. Muted amber (#E8A020) for warnings, forest green (#1A6B3A) for wins.

**Layout Paradigm:** Newspaper-style asymmetric grid. A wide left column holds the primary KPI strip and main chart. A narrower right column holds the campaign table and recommendations. No sidebar nav — all navigation is contextual.

**Signature Elements:**
- Bold oversized metric numbers with thin label text below
- Thick left-border accent on section headers
- Clean tabular data with alternating row shading

**Interaction Philosophy:** Minimal animation. Interactions are immediate and direct. Hover highlights rows with a subtle wash. No modals — everything is inline.

**Animation:** Subtle fade-in on page load. Charts draw in 400ms. No bouncing or elastic effects.

**Typography System:** Display: Playfair Display Bold for section titles. Body: Source Sans Pro. Numbers: Tabular figures with IBM Plex Mono for data cells.
</text>
<probability>0.08</probability>
</response>

## Response 3
<response>
<text>
**Design Movement:** Modern SaaS Analytics / Vercel/Linear-Inspired Dashboard
**Core Principles:**
- Clean light surface with deep navy sidebar for contrast
- Card-based modular layout with consistent 8px grid spacing
- Performance status communicated through color badges and progress indicators
- Recharts-powered interactive visualizations

**Color Philosophy:** Pure white cards (#FFFFFF) on a cool gray background (#F4F6F9). Deep navy sidebar (#0F172A). Primary accent: vivid indigo (#4F46E5). Green (#16A34A) for winners, red (#DC2626) for waste, amber (#D97706) for moderate.

**Layout Paradigm:** Fixed left sidebar (240px) with icon + label nav. Main area has a sticky top bar with account summary KPIs. Content below uses a responsive 12-column grid with mixed card sizes.

**Signature Elements:**
- Pill-shaped status badges (Excellent / Moderate / Poor)
- Sparkline trend indicators on KPI cards
- Animated donut chart for spend distribution

**Interaction Philosophy:** Smooth 200ms transitions on all interactive elements. Table rows are clickable with a slide-in detail drawer. Tooltips on all chart data points.

**Animation:** Staggered card entrance (50ms delay per card). Chart animations on mount. Smooth number transitions.

**Typography System:** Display: DM Sans 700 for headings. Body: DM Sans 400/500. Numbers: DM Mono for data precision. Consistent type scale: 12/14/16/20/24/32px.
</text>
<probability>0.09</probability>
</response>

---

**Chosen Design:** Response 1 — Dark Data Terminal. The electric cyan on deep charcoal creates an authoritative, data-dense command center aesthetic that suits a performance analytics dashboard. The monospace numbers, glowing metric cards, and color-coded performance bands make the data immediately scannable and actionable.
