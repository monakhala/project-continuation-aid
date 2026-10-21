---
name: Inventra
description: High-end B2B Inventory Intelligence with an editorial, financial-report aesthetic.
colors:
  primary: "#1F3A5F"
  primary-foreground: "#FFFEFB"
  background: "#FAF8F5"
  foreground: "#1A1A18"
  card: "#FFFEFB"
  card-foreground: "#1A1A18"
  muted: "#F2EFE9"
  muted-foreground: "#6B6860"
  accent: "#ECEFF3"
  accent-foreground: "#1F3A5F"
  border: "#E7E3DB"
  input: "#E7E3DB"
  success: "#2E7D32"
  warning: "#B7791F"
  destructive: "#B42318"
  destructive-foreground: "#FFFEFB"
  dark-background: "#14130F"
  dark-foreground: "#F2EFE8"
  dark-card: "#1C1B17"
  dark-border: "#2E2C26"
  dark-primary: "#8FB0E0"
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
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
---

# Design System

## Overview

Inventra adopts an editorial, financial-report aesthetic modeled after print financial journals, classical ledgers, and bespoke analytics terminals. The interface conveys quiet authority, mathematical precision, and absolute restraint. Every screen opens with a direct question and executive answer. Decorative embellishments, gradients, and box-shadows are banned.

## Colors

- **Paper Backgrounds**: `#FAF8F5` (light mode warm parchment) and `#14130F` (dark mode charcoal ink).
- **Cards & Surfaces**: `#FFFEFB` (light) and `#1C1B17` (dark).
- **Primary Ink**: `#1F3A5F` (deep navy ink) in light mode, `#8FB0E0` (soft cobalt) in dark mode.
- **Borders & Dividers**: Crisp 1px `#E7E3DB` (light) and `#2E2C26` (dark).
- **Status Indicators (Strictly Functional)**:
  - Healthy / OK: `#2E7D32` (dark forest green)
  - Warning / Low Stock / Approaching Expiry: `#B7791F` (warm amber)
  - Critical / Stockout / Expired / Margin Erosion: `#B42318` (deep crimson)

## Typography

- **Headlines & Display Figures**: *Instrument Serif* paired seamlessly with *IBM Plex Sans Arabic* for RTL localization.
- **Body & Controls**: *IBM Plex Sans* (Latin) and *IBM Plex Sans Arabic* (Arabic).
- **Data & Tables**: Strict tabular numerals (`tabular-nums` / `tnum`) across all monetary values, percentages, quantities, dates, and SKUs to prevent layout jitter.
- **Copywriting**: Calm, direct, authoritative. No hyphens or dashes in visible prose.

## Layout

- Strict 8px baseline grid with standard container padding (`p-6` to `p-8`).
- Header bar pinned to top with workspace title, status badges, currency selector, and language toggle.
- Dense, highly readable information architecture optimized for desktop displays and tablet warehouse operations.

## Elevation & Depth

- **Zero Drop-Shadows**: All cards and panels sit flush with the background, distinguished solely by 1px solid borders (`border border-border`) and subtle card fill contrast.
- Visual hierarchy is established through typographic scale, weight, and whitespace rather than elevation layers.

## Shapes

- Consistent 8px border radius (`rounded-lg`) for cards and tables.
- 6px border radius (`rounded-md`) for buttons, badges, and form inputs.
- Pill badges (`rounded-full`) reserved exclusively for status indicators.

## Components

- **Executive KPI Cards**: Clean borders, top-level micro-label, prominent serif number, inline delta indicator (`Delta`), and baseline comparison note.
- **Status Pills**: Discrete 8px colored dot followed by concise label text.
- **Allocator Bar**: Dedicated budget cap input with quick preset chips and live capital utilization progress bar.
- **Tables**: Subtle column headers (`th`), tabular numerals (`td`), and quiet row highlight on hover (`hover:bg-muted/40`).

## Do's and Don'ts

### Do
- Always use tabular numbers (`tabular-nums`) for currency, quantities, percentages, and dates.
- Render all user data through native React text children (zero raw HTML injection).
- Provide complete bilingual parity between English and Arabic (RTL).
- Highlight margin erosion immediately when selling price falls below current replacement cost.

### Don't
- Never use drop shadows or blur glows (`box-shadow`, `shadow-md`, `shadow-xl`).
- Never use chunky colored vertical border stripes on nav items or cards (`border-s-2` / `border-s-4`).
- Never invent demand numbers or fake confidence scores when sales history is insufficient.
- Never use emojis or decorative iconography in financial tables.
