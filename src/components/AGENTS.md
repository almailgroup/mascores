# Component rules

- One dialog generates/saves images; cancel rendering and revoke previews to avoid duplicates/leaks.
- Collapsing headers keep identity and tabs sticky.
- SportsHeaderBackground uses semantic surfaces and sampled logo colours, preserving artwork.
- Public standings share StandingsTable with position-label/qualification fallbacks.
- Portalled keyboard-accessible SeasonMenu selects seasons, rounds and club competitions; separate labels from stored values to prevent header clipping.
- Portal ticket overlays outside the browsing wrapper and lock background scrolling so transforms and bottom navigation cannot clip them.
- Use TeamCrest for missing club artwork and localized free-agent labels for unattached players so national call-ups never imply club membership.
- Avatar uploads use user-ID folders; crop dialogs portal outside page gestures to keep touch editing stable.
