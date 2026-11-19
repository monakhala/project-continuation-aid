---
name: Inventra
description: High-end B2B Inventory Intelligence with an atmospheric blue glass canvas and precision data typography.
colors:
  primary: "#04264D"
  primary-foreground: "#FCFCFC"
  background: "#AFC8E5"
  foreground: "#172C45"
  card: "#DCE9F7"
  card-foreground: "#172C45"
  muted: "#C5D8EE"
  muted-foreground: "#354D66"
  accent: "#E9F1FD"
  accent-foreground: "#075DCC"
  signal: "#087DFD"
  ink: "#0B1E38"
  ink-foreground: "#E7EBF1"
  ink-muted: "#A2B4CE"
  azure-deep: "#075DCC"
  border: "#9CB6D3"
  input: "#93AFCD"
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

Inventra uses an atmospheric blue canvas with layered frosted-glass surfaces. A deep navy glass hero, floating translucent sidebar, ice-blue metric panels, and a clear expiry-watch surface translate the supplied dashboard composition into the Inventra brand. Density stays purposeful: key signals are glanceable, and detailed tables remain legible.

Every screen opens with a direct question and an executive answer. One accent (azure) carries structure; the navy ink brand color carries identity.

## Brand

- **Logo**: the supplied Inventra lockup (emblem + wordmark on brand navy). The full lockup appears in the workspace sidebar and on the auth screen; the emblem mark with the typographic wordmark appears in compact chrome (landing header). Assets: `public/logo.png`, `public/logo-mark.png`, `public/favicon.png`, `public/favicon.ico`, `public/apple-touch-icon.png`.
- Never stretch, recolor, or add effects to the logo. Display it at its natural aspect ratio.

## Colors

- **Canvas & Ink**: blue atmosphere `#AFC8E5` with layered azure/navy light; dark blue-black ink `#172C45`; ice-blue reading surfaces `#DCE9F7`.
- **Primary (Inventra navy)**: `#04264D` — buttons, active states, primary chart series.
- **Signal (azure)**: `#087DFD` — the single structural accent: focus rings, progress fills, highlight chart series, feature icons. Darker azure `#075DCC` (accent-foreground) for accent text.
- **Surfaces**: secondary/muted `#C5D8EE`; accent wash `#E9F1FD`; KPI cards use four related translucent blue tints, never neutral white.
- **Borders & Dividers**: crisp 1px `#9CB6D3` light / `#263650` dark; floating surfaces use white/blue alpha hairlines.
- **Status Indicators (Strictly Functional)**: Healthy `#2E7D32`, Warning `#9C661A` (darkened to pass 4.5:1 as text), Critical `#B42318`.
- **Charts**: navy `#04264D`, slate `#6A7C8A`, azure `#087DFD`, light azure `#8ABEF7`, warm gray `#C9C3B6`.

## Typography

- **UI, page titles & data figures**: IBM Plex Sans / IBM Plex Sans Arabic; 400 body, 500 secondary labels, 600 headings and key values. Use tabular numbers and tight, deliberate tracking on values.
- **Editorial voice**: Instrument Serif (400 only) is used sparingly for the public-facing landing statement and selected screen-intro copy, not every heading or KPI.
- **Scale (dense data UI)**: 2xs 10px (chart micro-labels only, never interactive text) · xs 12px · sm 13px · base 14px · app headings 22–26px · display figures 28–42px via `.kpi-num`.
- **Small caps**: table headers and stat eyebrows are 12px uppercase with 0.08–0.1em tracking (`th`, `.eyebrow`) — data labels only, never page headings. Arabic is exempt (`[dir="rtl"]` disables transform and letterspacing to protect glyph joining).
- **Data & Tables**: strict tabular numerals across all monetary values, percentages, quantities, dates, and SKUs.
- **Arabic**: taller leading (1.7); numerics and dates stay LTR inside RTL prose.

## Surface Material (glass system)

- **Canvas**: fixed layered blue gradients (`#9CB9DC`, `#BED3EB`, `#8FADCE`) provide a visible, non-white field behind translucent UI.
- **Glass chrome** (`.glass`): blue-white fill `rgba(207,226,248,0.28)`, `backdrop-filter: blur(14px) saturate(150%)` — sticky header.
- **Floating sidebar** (`.glass-ink`): translucent navy with blur, margin, rounded corners, and a fine light edge.
- **Strong glass** (`.glass-strong`): blue-white fill `rgba(220,234,250,0.56)`, blur 18px — dialogs, toasts, auth card.
- **KPI cards**: four distinct translucent blue tints at 40–44% fill with blur 18px; hero glass uses a deep navy-to-azure treatment.
- **Reading surfaces** (tables, long forms): solid ice-blue `bg-card`. Glass is selective; avoid reducing table contrast.
- **Background field**: blue-only radial light, with no cream or white page wash.
- **Dark structural zone** (`.glass-ink`, `bg-ink`): the frosted sidebar and the AI copilot panel render as deep navy ink with white-alpha hairlines — the reference's dark technical zone, translated to the brand navy. Text on ink: `#E7EBF1` / `#A2B4CE` (7.8:1+).
- **Fallback**: `@supports not (backdrop-filter…)` renders glass as solid card or solid ink — no contrast or functionality depends on blur.

## Elevation & Depth

- Content surfaces sit flush: hierarchy comes from typography, borders, and fill contrast.
- Floating layers only (dialogs, toasts) receive the soft `--shadow-float`. No glow effects, no hard offset shadows, no decorative shadows on content.

## Shapes

- 12px radius (`rounded-lg`) for cards and tables; 10px (`rounded-md`) for buttons and inputs; 16–20px for dialogs and hero cards; pills (`rounded-full`) reserved for status chips, filter chips, and the language toggle.

## Components

- **Dashboard hero**: large blue-glass panel with the real inventory-health score in a circular ring, existing operational counts, and a compact FEFO watch panel beside it.
- **Executive KPI Cards**: four blue-tinted glass cards with sans-serif tabular figures, inline delta, and baseline note.
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
- Give glass surfaces a small hover lift, tactile active press, and visible focus-within edge; keep informational cards non-clickable.
- Respect `prefers-reduced-motion`.

### Don't
- Don't apply glass to dense reading surfaces or stack glass on glass.
- Don't use emojis as interface icons or loud decorative gradients beyond the quiet background field.
- Don't invent demand numbers or fake confidence scores.
- Don't use chunky colored border stripes on nav items or cards.
- Don't synthetic-bold Instrument Serif (it only ships weight 400).
