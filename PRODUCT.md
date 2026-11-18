# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

SME owners, wholesale distributors, warehouse operations managers, and inventory planners in Egypt and the MENA region managing supply chains under currency fluctuations, credit payment terms (*آجل*), and multi-hub distribution.

## Product Purpose

Inventra is a high-end B2B Inventory Intelligence & Management platform built with an editorial, financial-report aesthetic. It turns dated sales history into backtested demand forecasts, measures its own error rate, calculates restock recommendations line by line, shields gross margins against high inflation through replacement cost tracking, enforces First-Expired, First-Out (FEFO) batch clearance, and optimizes purchase orders within working capital budget caps.

## Positioning

Unlike bloated, opaque enterprise ERPs or generic spreadsheet tools, Inventra provides transparent, traceable inventory math. Every forecast is backtested, every restock recommendation explains its reasoning in plain English or Arabic, and its dual margin calculations protect businesses from selling at prices lower than current replacement costs.

## Operating Context

- Multi-warehouse logistics (e.g. Main Warehouse - 10th of Ramadan, Cairo Transit Hub, Alexandria Hub).
- Egyptian & MENA market realities: EGP currency shifts, supplier minimum order quantities (MOQs), pack sizes, and cash flow constraints.
- Fast-moving consumer goods (FMCG), beverages, pantry, and perishable items requiring proactive batch expiry management.
- Bilingual workflow: Full English and Arabic (RTL) interface with native typographic balance.

## Capabilities and Constraints

- Framework: TanStack Start v1 (React 19 + Vite 7), file-based routing via `@tanstack/react-router`.
- Calculation Engine: ESM adapter in `src/lib/inventra/core.js` verified by regression suites (`node --test`).
- Data Isolation: In-memory demo state with sample badges strictly isolated from cloud-persisted business snapshots.
- Security: Zero raw HTML injection (`dangerouslySetInnerHTML` banned); native React text rendering across all SKUs, names, and notes.
- Multi-Currency: EGP as primary default, with USD and SAR support.
- Cash-Constrained Restock: Greedy priority allocator ordering by profit impact and velocity within user-defined working capital limits.
- Multi-Hub Transfers: Inter-warehouse stock reallocation before placing external purchase orders.

## Brand Commitments

- Aesthetic: Editorial financial publication on warm paper with restrained frosted-glass floating chrome (header, sidebar, dialogs, toasts); flush content surfaces, 1px borders, 12px card radii.
- Colors: Inventra navy primary (`#04264D` light / `#8ABEF7` dark) with azure signal accents (`#087DFD`), paper background (`#FAF8F5` light / `#0E1522` dark), functional status indicators (Healthy `#2E7D32`, Warning `#9C661A`, Critical `#B42318`).
- Typography: Instrument Serif for headlines and large KPI numbers, IBM Plex Sans for body text, falling back to IBM Plex Sans Arabic in RTL.
- Microcopy: Calm, definitive, no hyphens/dashes in visible text, opening with a direct question and executive answer on every screen.

## Evidence on Hand

- Core test suite in `legacy-inventra/test/core.test.js` and `legacy-inventra/test/import.test.js` (36 passing unit tests).
- Automated integration and feature suite in `src/test/features.test.ts` verifying currency, margin erosion, budget allocation, FEFO classification, and hub transfers.

## Product Principles

1. **Honest Math**: Never guess or invent demand; measure backtest error and disclose lack of history plainly.
2. **Inflation Shield**: Track current replacement cost alongside historical cost to stop margin erosion before it happens.
3. **Capital Restraint**: Restock the highest profit-per-pound items first when working capital is constrained.
4. **FEFO Discipline**: Highlight batch expiration early and suggest tiered markdown actions (flash clearance, promo bundles) before write-offs occur.
5. **Operational Serenity**: Clean, tabular editorial layouts that respect the operator's focus and dignity.
