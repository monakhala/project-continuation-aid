# Budget Restock Report and AI Adjustment

## Goal
Add a downloadable PDF of the current budget-based restock allocation and an AI-assisted, reviewable adjustment flow for upcoming demand changes or supplier constraints.

## Work
- Add a browser-generated PDF report with the budget, funded and deferred SKUs, allocated quantities and spend, and the existing expected gross profit lift.
- Add a protected server function using the Lovable AI Gateway to propose restock quantities from the manager's constraint description and current recommendation data.
- Validate model suggestions against known SKUs, recommendation limits, pack sizes, and the entered budget. Keep changes as a preview until the manager applies them; purchase orders remain separately confirmed.
- Add English and Arabic interface text and retain the existing restock calculations and data model.
- Add focused tests for budget bounds and allowed quantities, then verify the download and AI flow where credentials and preview access permit.

## Technical details
- Use the workspace default Responses model through `@lovable.dev/ai-gateway`; do not expose credentials to the browser.
- Require an authenticated session for AI generation to limit metered use. The PDF export stays local to the browser.
- Keep the AI adjustment as temporary UI state and do not change routes, core calculations, persisted records, or backend schema.