# design-sync notes — BT Investments

- Scope (Randy, 2026-07-08): public brand & website look + print/deal
  collateral ONLY. NO internal app UI (dashed borders, dark mode, etc.).
- This repo is a Next.js APP, not a component package. The design system
  source is authored at `src/design-system/` specifically for this sync:
  12 standalone components + `brand.css`, values extracted verbatim from
  `src/app/globals.css` (.marketing-scope palette) and the hero wordmark.
- Two olives are intentional: #585732 (primary, buttons/popups) and
  #76794c (INVESTMENTS eyebrow / app wordmark). Do not merge them.
- Fonts load via Google Fonts @import in brand.css (remote — expect
  [FONT_REMOTE], not [FONT_MISSING]).
- Converter runs in synth-entry mode (no dist): componentSrcMap
  enumerates all 12 components.

## Known render warns
- (none — 12/12 render cleanly; GRID_OVERFLOW on BTWordmark/StatNumber
  resolved via cfg.overrides cardMode: column)

## Re-sync risks
- src/design-system/ is authored FOR this sync — it does not track the
  live site automatically. If globals.css .marketing-scope palette or the
  hero wordmark change, update brand.css + components to match.
- Fonts come from a Google Fonts @import at runtime ([FONT_REMOTE]) — if
  Google Fonts URLs change format, cards render in fallback serif.
- Build uses synth-entry: --entry ./src/design-system/index.ts and
  --node-modules ./node_modules (repo root). Playwright chromium was
  installed to ~/.cache/ms-playwright for the render check.
- LetterheadHeader default contact lines + preview use real contact info
  (randy@, phone) — intentional, per print-collateral purpose.
