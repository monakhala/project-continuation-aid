---
name: Inventra
description: High-end B2B Inventory Intelligence with a warm-paper editorial base and restrained glassmorphism chrome.
colors:
  primary: "#04264D"
  primary-foreground: "#FCFCFC"
  background: "#FAF8F5"
  foreground: "#212732"
  card: "#FFFEFB"
  card-foreground: "#212732"
  muted: "#F2EFE9"
  muted-foreground: "#5C6B78"
  accent: "#E9F1FD"
  accent-foreground: "#075DCC"
  signal: "#087DFD"
  ink: "#0B1E38"
  ink-foreground: "#E7EBF1"
  ink-muted: "#A2B4CE"
  azure-deep: "#075DCC"
  border: "#E5E1DA"
  input: "#E4E0D8"
  ring: "#087DFD"
  success: "#2E7D32"
  warning: "#9C661A"
  destructive: "#B42318"
  destructive-foreground: "#FCFCFC"
  dark-background: "#0E1522"
  dark-foreground: "#E9EDF4"
  dark-card: "#16202F"
  dark-border: "#263650"
  dark-primary: "#8ABEF7"
typography:
  display:
    fontFamily: "Instrument Serif, IBM Plex Sans Arabic, Georgia, serif"
    fontWeight: 400
  body:
    fontFamily: "IBM Plex Sans, IBM Plex Sans Arabic, system-ui, sans-serif"
    fontWeight: 400
  numbers:
    fontFamily: "IBM Plex Sans, monospace"
    fontVariantNumeric: "tabular-nums"
  scale:
    "2xs": "10px (chart micro-labels only)"
    xs: "12px"
    sm: "13px"
    base: "14px"
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px (cards, KPI, panels — reference geometry)"
  2xl: "20px (hero band, dialogs, ink panels)"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design System

## Overview

Inventra pairs the calm authority of an editorial financial journal with a restrained, frosted-glass material for floating chrome. The interface conveys mathematical precision and operational serenity: dense data stays on solid paper surfaces, while the chrome that floats above scrolling content (top bar, sidebar, dialogs, toasts, KPI cards) is rendered as high-fill "paper glass" — translucent enough to feel layered, opaque enough to keep 4.5:1 text contrast over the composed backdrop.

Every screen opens with a direct question and an executive answer. One accent (azure) carries structure; the navy ink brand color carries identity.

## Brand

- **Logo**: the supplied Inventra lockup (emblem + wordmark on brand navy). The full lockup appears in the workspace sidebar and on the auth screen; the emblem mark with the typographic wordmark appears in compact chrome (landing header). Assets: `public/logo.png`, `public/logo-mark.png`, `public/favicon.png`, `public/favicon.ico`, `public/apple-touch-icon.png`.
- Never stretch, recolor, or add effects to the logo. Display it at its natural aspect ratio.

## Colors

- **Paper & Ink**: warm parchment background `#FAF8F5`, blue-black ink `#212732`, tinted-white cards `#FFFEFB`.
- **Primary (Inventra navy)**: `#04264D` — buttons, active states, primary chart series.
- **Signal (azure)**: `#087DFD` — the single structural accent: focus rings, progress fills, highlight chart series, feature icons. Darker azure `#075DCC` (accent-foreground) for accent text.
- **Surfaces**: secondary/muted `#F2EFE9`; accent wash `#E9F1FD` (azure-tinted) for hovers and selections.
- **Borders & Dividers**: crisp 1px `#E5E1DA` light / `#263650` dark; sidebar hairlines use navy-alpha.
- **Status Indicators (Strictly Functional)**: Healthy `#2E7D32`, Warning `#9C661A` (darkened to pass 4.5:1 as text), Critical `#B42318`.
- **Charts**: navy `#04264D`, slate `#6A7C8A`, azure `#087DFD`, light azure `#8ABEF7`, warm gray `#C9C3B6`.

## Typography

- **Headlines & Display Figures**: Instrument Serif (400 only — never synthetic bold), paired with IBM Plex Sans Arabic for RTL headings.
- **Body & Controls**: IBM Plex Sans + IBM Plex Sans Arabic; 400 body, 500 labels, 600 buttons and inline emphasis.
- **Scale (dense data UI)**: 2xs 10px (chart micro-labels only, never interactive text) · xs 12px · sm 13px · base 14px · page titles 26px · hero answers 31.5px serif · display figures 34–45px via `.kpi-num` clamp.
- **Small caps**: table headers and stat eyebrows are 12px uppercase with 0.08–0.1em tracking (`th`, `.eyebrow`) — data labels only, never page headings. Arabic is exempt (`[dir="rtl"]` disables transform and letterspacing to protect glyph joining).
- **Data & Tables**: strict tabular numerals across all monetary values, percentages, quantities, dates, and SKUs.
- **Arabic**: taller leading (1.7); numerics and dates stay LTR inside RTL prose.

## Surface Material (glass system)

- **Glass chrome** (`.glass`): fill `rgba(255,254,251,0.66)`, `backdrop-filter: blur(14px) saturate(150%)` — sticky header, sidebar.
- **Strong glass** (`.glass-strong`): fill `rgba(255,254,251,0.88)`, blur 18px — dialogs, toasts, auth card.
- **KPI cards**: `bg-card/75 backdrop-blur-sm` — the lightest frost, reserved for glanceable figures.
- **Reading surfaces** (tables, long forms): solid `bg-card`. Glass is never stacked on glass.
- **Background field**: a fixed, non-interactive wash (azure, navy, warm-cream radial tints) gives frosted chrome something to refract — the warm field echoes the reference's tinted zones.
- **Dark structural zone** (`.glass-ink`, `bg-ink`): the frosted sidebar and the AI copilot panel render as deep navy ink with white-alpha hairlines — the reference's dark technical zone, translated to the brand navy. Text on ink: `#E7EBF1` / `#A2B4CE` (7.8:1+).
- **Fallback**: `@supports not (backdrop-filter…)` renders glass as solid card or solid ink — no contrast or functionality depends on blur.

## Elevation & Depth

- Content surfaces sit flush: hierarchy comes from typography, borders, and fill contrast.
- Floating layers only (dialogs, toasts) receive the soft `--shadow-float`. No glow effects, no hard offset shadows, no decorative shadows on content.

## Shapes

- 12px radius (`rounded-lg`) for cards and tables; 10px (`rounded-md`) for buttons and inputs; 16–20px for dialogs and hero cards; pills (`rounded-full`) reserved for status chips, filter chips, and the language toggle.

## Components

- **Hero band**: every screen opens with a tinted azure band — small-caps eyebrow question, large serif answer (reference greeting-hero principle).
- **Executive KPI Cards**: frosted glass, each card carrying its own quiet tint (azure, navy, cream, slate — the reference's tinted stat-grid principle), micro-label eyebrow, prominent serif figure, inline delta, baseline note.
- **AI Copilot**: dark ink panel with glass bubbles — azure-deep user messages, white-alpha assistant surfaces.
- **Status Pills**: 8px tone dot + concise label; never color alone.
- **Allocator Bar**: budget cap input, preset pill chips, azure capital-utilization progress.
- **Tables**: quiet headers, tabular numerals, `hover:bg-muted/40` rows.

## Do's and Don'ts

### Do
- Use tabular numbers for currency, quantities, percentages, and dates.
- Render all user data through native React text children.
- Keep full bilingual parity (EN/AR, RTL) with logical CSS properties.
- Verify text contrast over glass against the composed backdrop.
- Respect `prefers-reduced-motion`.

### Don't
- Don't apply glass to dense reading surfaces or stack glass on glass.
- Don't use emojis as interface icons or loud decorative gradients beyond the quiet background field.
- Don't invent demand numbers or fake confidence scores.
- Don't use chunky colored border stripes on nav items or cards.
- Don't synthetic-bold Instrument Serif (it only ships weight 400).
