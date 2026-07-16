# DESIGN.md

Visual system for the Democraft landing page (`apps/landing-page`). Captured
from the committed code so future variants and components stay on-brand.

> **Register: brand.** Design IS the product on this surface. The system is
> deliberately restrained: a near-black canvas, one indigo accent, and
> typographic hierarchy doing the work. See `PRODUCT.md` for the strategic why.

---

## Color

The palette lives as CSS custom properties scoped to `.landing-shell` in
`app/global.css`. Values are committed hex; OKLCH equivalents are noted for new
tokens (the recommended format going forward).

### Surfaces (dark canvas, ascending lightness)

| Token | Value | Role | OKLCH (approx) |
| --- | --- | --- | --- |
| `--landing-background` | `#08090a` | Page canvas, near-black | `oklch(0.16 0.003 264)` |
| `--landing-surface-1` | `#131416` | Recessed panels (code block bg, video frame) | `oklch(0.21 0.004 264)` |
| `--landing-surface-2` | `#18191c` | Inset bars, active tabs, copy-button bg | `oklch(0.24 0.005 264)` |
| `--landing-surface-3` | `#1d1e21` | Raised surface | `oklch(0.26 0.005 264)` |
| `--landing-hover` | `#222327` | Hover state for secondary buttons / rows | `oklch(0.28 0.005 264)` |
| `--landing-active` | `#28292e` | Pressed state | `oklch(0.30 0.005 264)` |

### Foreground (text)

| Token | Value | Role | Contrast on canvas |
| --- | --- | --- | --- |
| `--landing-foreground` | `#f4f5f8` | Headings, primary text | ~17.5:1 (AAA) |
| `--landing-foreground-secondary` | `#c6c8ce` | Body copy, button-secondary text | ~11.6:1 (AAA) |
| `--landing-muted` | `#8a8d96` | Kickers, nav, table headers, tab text | ~5.4:1 (AA) |
| `--landing-subtle` | `#62656d` | Code line numbers, step numerals, "+" | ~2.9:1 — **decorative/non-text only** |

> **Contrast rule.** Body copy must hit ≥4.5:1. `--landing-subtle` is below the
> body-text floor by design — restrict it to purely decorative affordances
> (line numbers, step markers). Never use it for content a reader must read.
> `--landing-muted` (5.4:1) is the floor for meaningful-but-secondary text.

### Accent (single saturated indigo)

| Token | Value | Role |
| --- | --- | --- |
| `--landing-accent` | `#5e6ad2` | Primary buttons, focus rings, active tab underline, check icon |
| `--landing-accent-hover` | `#6b76da` | Primary button hover |
| `--landing-accent-soft` | `rgba(94,106,210,0.14)` | Reserved: soft accent fills/tints |

The accent is the **only** saturated color in the chrome. State is never color-
alone (see Accessibility): the comparison table pairs the accent check icon with
text, the active tab pairs the accent underline with foreground-weight text.

### Borders

| Token | Value | Role |
| --- | --- | --- |
| `--landing-border-subtle` | `rgba(255,255,255,0.06)` | Section dividers, row separators |
| `--landing-border` | `rgba(255,255,255,0.09)` | Card/panel edges, button-secondary border |

Borders are low-opacity white over the dark canvas — **never** a side-stripe
accent. Full borders or nothing.

### Aurora (hero only, motion)

The hero background is a WebGL aurora (`components/Aurora.jsx`) with color stops
`["#5227FF", "#7cff67", "#F43F5E", "#A855F7"]`, amplitude `0.6`, blend `2`. These
are a **scene exception** — vibrant, animated, confined to the hero. They do not
enter the chrome palette. Under `prefers-reduced-motion` the aurora is replaced
by a static radial gradient
`radial-gradient(ellipse at center, rgba(82,39,255,0.2), rgba(124,255,103,0.06) 42%, transparent 68%)`.

---

## Typography

**Typeface: Schibsted Grotesk** (`next/font/google`, variable, `--font-sans`),
loaded in `app/layout.tsx`. Single family, multiple weights. No pairing — the
contrast axis is weight + size, not serif/sans.

| Role | Spec | Token / utility |
| --- | --- | --- |
| Display H1 (hero) | `clamp(46px, 5vw, 68px)`, weight `550`, tracking `-0.035em`, leading `1.02` | inline |
| Section H2 | `clamp(36px, 3.5vw, 48px)`, weight `550`, tracking `-0.025em`, leading `1.12`, max `720px` | `.landing-heading` |
| Subhead H3 | `18px`, weight `500`, leading `26px` | inline |
| Body | `16px`, weight `400`, leading `26px`, max `68ch` | `.landing-copy` |
| Secondary body | `18px` leading `28px` (hero lede) | inline |
| Kicker / label | `14px`, weight `400`, leading `20px`, color muted | `.landing-kicker` |
| Button | `15px`, weight `500`, leading `20px` | `.landing-button` |
| Nav / footer | `13–14px` | inline |
| Code (inline) | mono, `font-feature-settings: "calt" 0` | `pre, code` |

**Rules**
- Display tracking floor: `-0.035em` (hero) — never tighter than `-0.04em`.
- `text-wrap: balance` on H1–H2 (`.landing-heading`, hero); `text-wrap: pretty`
  on body (`.landing-copy`).
- Body line length capped at `65–68ch`.
- Code blocks use **Shiki** (`github-dark-default` theme) at `11–14px`; the code
  panel enforces a faux editor chrome (path bar, filename tab, line numbers).

> **Note on the kicker pattern.** `.landing-kicker` is used as a deliberate,
  named section label ("One file, one real workflow", "The pipeline", "Why
  code", "The comparison", "FAQ", "Local workflow") — **not** a generic
  all-caps tracked eyebrow above every section. It is sentence-case and muted.
  Do not proliferate it into a reflex eyebrow.

---

## Spacing & Layout

| Token | Value | Use |
| --- | --- | --- |
| `--landing-content` | `1360px` | Max content width |
| `--landing-narrow` | `680px` | Narrow column / prose |
| `.landing-container` | `min(100% - 32px, 1360px)` | Centered container (mobile: `min(100% - 32px, 640px)`) |

- **Section rhythm:** `padding-block: clamp(104px, 10vw, 144px)`, separated by a
  `1px` subtle top border. Mobile flattens to `88px`.
- **Two-column pattern (recurring):** left = kicker + heading + copy, right =
  artifact (code/install/comparison). Ratios vary (`0.7fr/1.3fr`,
  `0.68fr/1.32fr`, `0.8fr/1.2fr`) to avoid identical repetition. Collapses to
  single column at `≤800px`.
- **Breakpoint strategy:** max-variant arbitrary breakpoints
  (`max-[800px]`, `max-[1000px]`, `max-[720px]`, `max-[560px]`) — Tailwind v4.
  No `sm:`/`md:` scale; values are chosen per component.
- Grid for lists uses semantic markup (`<ol>`, `<details>`, table), **not** card
  grids.

---

## Radii

| Token | Value | Use |
| --- | --- | --- |
| `--landing-radius-sm` | `4px` | Small controls |
| `--landing-radius-md` | `6px` | Buttons, copy button, nav hover |
| `--landing-radius-lg` | `12px` | Code panels, video frame |

Hard ceiling for cards/panels: **12–16px**. No 24px+ rounding (anti-ref:
"insanely rounded" SaaS tell). Tag/button pills would be full-round, but the
current system uses 6px rectangles throughout.

---

## Components

### Buttons (`.landing-button`)
Inline-flex, `min-height: 32px`, `6px 10px` padding, `6px` radius, 90ms
`ease-out` transitions on background/border/color. Two variants:
- **Primary** (`-primary`): accent bg, near-white text (`#f8f8ff`), accent-hover
  on hover.
- **Secondary** (`-secondary`): surface-2 bg, border, secondary-foreground text;
  hover lifts border + bg + text to foreground.

Never pair a 1px border with a wide drop shadow on the same element (anti-ref:
ghost-card). Buttons are borderless (primary) or single-border (secondary), no
shadow.

### Links (`.landing-link`)
Inline-flex with `8px` gap, secondary-foreground, hover to foreground, 90ms
color transition. Used in nav, footer, and inline "Explore the authoring API →".

### Code panel (`CodePanel`)
Server component, Shiki-highlighted TS. Editor chrome: path bar → filename tab →
line-numbered code. Bordered, `surface-1` bg, `12px` radius. The TypeScript demo
file is treated as a first-class design object.

### Install command (`InstallCommand`)
Client component. npm/pnpm/yarn `role="tablist"` tabs (active = accent
underline + foreground text; inactive = muted, hover lifts) over a copy-to-
clipboard `<pre>` block. Copy button has `aria-label` state, fallback clipboard
path, 1500ms copied feedback.

### Section lists (`HowItWorks`, `ProductPrinciples`, `Comparison`, `FAQ`)
The site favors **editorial list / table layouts over card grids**:
- **HowItWorks:** ordered list, each row `grid-cols-[32px_1fr_16px]` with `0N`
  numeral, title, copy, and a trailing arrow that lifts on hover. Hairline
  borders, hover row-tint.
- **ProductPrinciples:** 2-col grid of `<article>` divided by hairline borders
  (even column gets left border), no cards.
- **Comparison:** 3-col data table (Workflow / Manual / Democraft), Democraft
  cell = accent Check icon + text (color-blind safe). Collapses to 2-col on
  mobile, label spans full width.
- **FAQ:** native `<details>`/`<summary>`; the `+` marker rotates 45° to `×` on
  open, with `motion-reduce:transition-none`.

### Hero (`landing.tsx` hero section)
`min-h-[90svh]` two-column grid (copy left, video right). Video is the **real**
Democraft-rendered walkthrough (`/demos/talento-pipeline.mp4`), `autoPlay loop
muted controls playsInline`, with a poster. `saturate-[0.92]` to integrate with
the dark canvas. The aurora sits behind at z-0, content at z-10.

### Header / footer
Sticky header (`bg-[rgba(15,16,18,0.94)]`, z-20, hairline bottom border):
BrandMark + wordmark left, text nav center (`max-[720px]:hidden`), GitHub
secondary button right. Footer: 3-col grid (wordmark / links / MIT license),
collapses to 1-col on mobile.

### Brand mark (`brand.tsx`)
`next/image` PNG assets in `/brand/`: `democraft-mark-{dark,light}.png` (nav
height `h-7`), `democraft-lockup-{dark,light}.png`, `democraft-stacked-{dark,
light}.png`. Dark variants used on the dark canvas.

---

## Motion

- **Default duration:** `90ms` for color/bg/border transitions
  (`ease-out`-family). Snappy, not sluggish.
- **Hover lifts:** row tints (`surface-1`), text foreground promotion, the
  HowItWorks arrow muted→muted-promote.
- **Hero aurora:** the one sustained animation — WebGL simplex-noise color ramp.
  Fully replaced by a static radial gradient under reduced motion.
- **`+` → `×`:** FAQ summary marker rotates 45° on `<details>` open;
  `motion-reduce:transition-none` disables it.
- **Reduced motion is non-optional.** `@media (prefers-reduced-motion: reduce)`
  zeroes transitions/animations and `scroll-behavior` globally
  (`app/global.css`), and `HeroAurora` swaps to the static gradient via
  `useSyncExternalStore`. New animations must follow this pattern: provide a
  real static alternative, not just a shortened duration.
- No bounce/elastic; exponential ease-outs only when easing is needed.

---

## Interaction & a11y

- **Focus:** `:focus-visible` on `a, button, summary` → `2px` accent outline,
  `3px` offset.
- **Keyboard:** nav, tabs (`role="tablist"`), `<details>`, and copy button are
  all keyboard-operable; semantic HTML throughout.
- **Colorblind safety:** state never color-alone. Accent always paired with an
  icon (Check), underline, or text weight. Target: WCAG 2.1 AA +
  deuteranopia/protanopia-safe (see `PRODUCT.md`).
- **Dropdowns:** none currently. If added, use native `<dialog>`/popover or a
  portal to escape the sticky header's stacking context — not `position:
  absolute` inside `overflow: hidden`.

---

## Iconography

**lucide-react** (`ArrowRight`, `Github`, `Check`, `Copy`). Sizes 14px default,
inline with `8px` gap. Icons are decorative when paired with text
(`aria-hidden` where appropriate) and never the sole carrier of meaning.

---

## Tech stack (for context)

Next.js 15 (App Router, RSC) · React 19 · Tailwind CSS v4 (`@import "tailwindcss"`
+ `@source`, arbitrary `max-[Npx]` breakpoints, no `tailwind.config`) · Shiki for
code highlighting · `ogl` for the WebGL aurora · lucide-react icons.
`next/font/google` for Schibsted Grotesk. Design tokens are plain CSS custom
properties in `app/global.css`, not Tailwind theme config.
