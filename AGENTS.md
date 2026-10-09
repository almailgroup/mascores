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

- Store reporter identity photos in private user-scoped storage and issue short-lived owner-authorized links; identity documents must never have public URLs.
- Keep shared-image generation and saving in one share dialog, with cancellable rendering and revoked preview URLs, to prevent redundant work and memory leaks.
- Save images on iOS through the add-only PhotoLibrary bridge registered by the scene controller; web uses file sharing with an explicit download alternative so camera-roll actions never silently download.
- Record and escalate bans with database triggers and per-user transaction locks, retaining history after restrictions are lifted; every write path must follow the same strike rules.
- Use the shared AppShell gesture controller for elastic content pull refresh and cancellable edge-back transforms with an inert previous-page preview; defer navigation until release and leave fields/scrollable sheets alone.
- Serve optimized portrait asset copies through a shared portrait resolver while retaining original URLs as fallbacks; this reduces repeated photo transfers without changing stored originals.
- Scope reporter news uploads to their user-ID folder and active reporter storage policies; administrator upload access stays separate.
