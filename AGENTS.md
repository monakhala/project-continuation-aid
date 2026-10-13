<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Inventra architecture
- Use TanStack Start routes for the public landing/auth pages and named app sections; keep the original upload sources under `legacy-inventra` for traceability.
- Reuse the uploaded pure calculation engine through an ESM adapter rather than reimplementing its formulas; regression tests run against the retained CommonJS sources.
- Keep demo state in a separate browser-memory provider and business snapshots in Cloud with membership-based RLS and version-checked transactional saves; this prevents demo contamination and lost concurrent edits.
- Store team roles in a separate protected membership table; owner-created invitation tokens grant only the recorded workspace role.
- Render imported text through React text children; never inject user-controlled HTML.
