# BT Investments — build conventions

**What this is**: the public brand of btinvestments.co (real-estate investment,
Washington state) — editorial, old-money-minimal, cream & olive. Use it for
marketing pages, one-pagers, and deal collateral. It is NOT a web-app UI kit:
no dashed borders, no dark-mode toggling — sections are explicitly cream or dark.

**Setup**: no provider needed. Build page sections with `MarketingSection`
(tone="cream" | "creamDim" | "dark") — it sets the background, text color, and
Inter base font. `styles.css` loads the three brand fonts from Google Fonts.

**Styling idiom**: CSS custom properties + inline styles. There are NO utility
classes in this system — style your layout glue with inline `style` using these
tokens (all defined in `styles.css`):

| Token | Value | Use |
|---|---|---|
| `--bt-cream` / `--bt-cream-dim` | #ffffff / #f0eee5 | light surfaces |
| `--bt-dark` / `--bt-dark-soft` | #161614 / #1d1d1a | dark bands / panels |
| `--bt-olive` | #585732 | primary brand green: buttons, popups, rules |
| `--bt-olive-light` / `--bt-olive-pale` | #747250 / #cdcb95 | icons / display figures & pale accents on dark |
| `--bt-olive-bright` | #76794c | ONLY the INVESTMENTS wordmark line & kickers |
| `--bt-ink` / `--bt-ink-on-dark` | #1a1a17 / #faf9f4 | headings/body per surface |
| `--bt-muted` / `--bt-muted-on-dark` | #3d3a35 / #b8b0a0 | secondary text per surface |
| `--bt-font-display` | Cormorant Garamond | headlines, big figures, italic olive emphasis |
| `--bt-font-sans` | Inter | body, eyebrows, buttons, labels |
| `--bt-font-annotation` | Raleway | photo annotation labels only |
| `--bt-track-eyebrow/-wordmark/-tagline/-label` | 0.32/0.5/0.38/0.28em | uppercase letter-spacing scale |
| `--bt-radius-pill/-card/-panel` | 9999px/1rem/0.75rem | buttons / cards / form panels |

Rules the brand never breaks: headings are Cormorant Garamond weight 500 (never
bold sans); emphasis inside a heading is italic olive (`SectionHeading`'s
`emphasis` prop); small labels are uppercase Inter with wide tracking (`Eyebrow`);
buttons are pills (`MarketingButton`); the two olives are distinct — don't swap
#585732 and #76794c; never use pure black (#000) — dark is `--bt-dark`.

**Where the truth lives**: read `styles.css` (token definitions + fonts) and each
component's `.prompt.md` / `.d.ts` before styling.

**Idiomatic snippet**:
```jsx
<MarketingSection tone="dark">
  <SectionHeading eyebrow="See The Numbers" emphasis="speaks for itself." onDark>
    Our track record
  </SectionHeading>
  <div style={{ display: "flex", gap: "3.5rem", marginTop: "2.5rem" }}>
    <StatNumber value="120+" label="Homes Purchased" />
    <StatNumber value="7" label="Day Fastest Close" />
  </div>
  <div style={{ marginTop: "2.5rem" }}>
    <MarketingButton variant="onDark">See Our Deals</MarketingButton>
  </div>
</MarketingSection>
```
