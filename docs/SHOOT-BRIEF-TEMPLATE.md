# Infinite Media shoot brief, locked template

The canonical format for every Infinite Media shoot brief. Locked from the
first published brief (`fullstack-shoot-2`, Aug 2026, LEKA/Randy).

**A brief is a hand-authored static HTML file, not a React component.** That is
a deliberate decision, not an oversight. The file is served byte for byte, so
the design is guaranteed identical to what was authored and reviewed, and it
cannot drift when unrelated app code changes. Briefs are produced by an agent
session that can emit final HTML directly, and at this volume content-as-data
buys nothing. Revisit only if hand-authoring ever becomes a chore.

## Publishing a brief

1. Copy the skeleton below into `public/shoot-briefs/<slug>.html`
2. Swap the content. Do not touch the `:root` tokens or the CSS.
3. It is live at `https://btinvestments.co/shoot-briefs/<slug>`

No code change is needed. The rewrite in `next.config.ts` maps
`/shoot-briefs/:slug` to the static file, so an unknown slug 404s cleanly
because the target simply does not exist. Same pattern as `/proposals/:slug`
and `/proofs/:slug`.

## Locked invariants

Everything here holds across briefs. Only the content and the client logo swap.

| Element | Rule |
|---|---|
| Palette | Dark-first. `--paper:#0D0B09`, `--ink:#E8E5DD`, `--gold:#E3C466`, `--hair:#332D26`. Light: `#E8E5DD` / `#16100E` / `#8A6D12` / `#CDCDC8` |
| Fonts | Newsreader (Google Fonts) for serif, system stack for sans |
| Masthead | "Infinite Media" italic left, "SHOOT BRIEF" tracked caps right |
| Title | Serif display, client name with `<em>` on the second word, italic subtitle below |
| Facts | Labeled rows. DATE / TIME / FORMAT on line one, LOCATION on line two |
| Section heading | Rule-flanked italic, centered |
| Topics | Gold tabular number, serif name, dotted leader, tracked-caps keyword right, one sans description |
| Footer | Centered lockup: Infinite Media wordmark, small x, client logo. Both linked |

### Three things that are easy to get wrong

**The viewport meta is required.** Without it iOS Safari lays out at 980px and
zooms out, and the `max-width:520px` block never fires, so the topic line never
wraps and the dotted leaders never hide. The page then looks broken on exactly
the device the recipient is most likely to use. The first brief arrived without
it and it had to be added by hand.

**`noindex, nofollow` stays.** These are private client links, not public pages.
Matches the `/proposals` house pattern.

**Both footer marks and the masthead mark are links**, keyboard focusable, with
a visible focus ring. The masthead mark scales from its LEFT edge because it is
left-aligned, and centre-origin scaling makes it visibly drift.

## Skeleton

Replace every `[[ ... ]]` placeholder. Repeat the `.topic` block per topic.
The client logo is an inline SVG; swap it per client and keep `fill="var(--ink)"`
on any text paths so it inverts correctly in light mode.

```html
<title>[[CLIENT]] — [[BRIEF TITLE]]</title>
<meta name="robots" content="noindex, nofollow">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&display=swap">
<style>
  :root{
    --paper:#0D0B09; --ink:#E8E5DD; --gold:#E3C466; --hair:#332D26;
    --serif:"Newsreader",Georgia,"Times New Roman",serif;
    --sans:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  }
  @media (prefers-color-scheme:light){
    :root:not([data-theme="dark"]){
      --paper:#E8E5DD; --ink:#16100E; --gold:#8A6D12; --hair:#CDCDC8;
    }
  }
  :root[data-theme="light"]{
    --paper:#E8E5DD; --ink:#16100E; --gold:#8A6D12; --hair:#CDCDC8;
  }
  :root[data-theme="dark"]{
    --paper:#0D0B09; --ink:#E8E5DD; --gold:#E3C466; --hair:#332D26;
  }

  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--serif);
       font-size:17px;line-height:1.6;-webkit-text-size-adjust:100%;
       font-optical-sizing:auto}
  .wrap{max-width:40rem;margin:0 auto;padding:48px 22px 68px}

  /* masthead */
  .mark{display:flex;justify-content:space-between;align-items:baseline;
        margin-bottom:44px}
  .mark .im{font-style:italic;font-size:19px;letter-spacing:.01em}
  .mark .kind{font-family:var(--sans);font-size:10.5px;font-weight:600;
              letter-spacing:.34em;text-transform:uppercase;opacity:.55}

  h1{margin:0;font-weight:400;font-size:clamp(40px,9vw,62px);line-height:1.02;
     letter-spacing:-.02em;text-wrap:balance}
  h1 em{font-style:italic}
  .no2{display:block;font-style:italic;font-size:clamp(24px,5vw,34px);
       margin-top:6px;opacity:.8}

  /* logistics — two labeled lines */
  .facts{margin:20px 0 0;font-family:var(--sans);font-size:12.5px;
         letter-spacing:.03em;line-height:1.85}
  .facts .k{font-size:10px;font-weight:600;letter-spacing:.22em;
            text-transform:uppercase;opacity:.5;margin-right:7px}
  .facts .v{font-weight:600;opacity:.85}
  .facts .sep{opacity:.35;margin:0 10px}

  /* section heading — rule-flanked italic */
  .sect{display:flex;align-items:center;gap:16px;margin:34px 0 10px}
  .sect i{flex:1;height:1px;background:var(--hair)}
  .sect span{font-style:italic;font-size:21px;letter-spacing:.01em}

  .note{margin:0 0 26px;text-align:center;font-family:var(--sans);
        font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.5}

  /* topics */
  .topic{padding:24px 0;border-bottom:1px solid var(--hair)}
  .topic:last-of-type{border-bottom:0}
  .tline{display:flex;align-items:baseline;gap:12px}
  .tno{font-family:var(--sans);font-size:11px;font-weight:600;
       letter-spacing:.18em;color:var(--gold);flex:none;
       font-variant-numeric:tabular-nums}
  .tname{font-size:23px;letter-spacing:-.01em;line-height:1.2;text-wrap:balance}
  .tline .dots{flex:1;border-bottom:1px dotted var(--hair);
               transform:translateY(-5px);min-width:20px}
  .tkw{font-family:var(--sans);font-size:10px;font-weight:600;
       letter-spacing:.2em;text-transform:uppercase;opacity:.5;flex:none;
       white-space:nowrap}
  .why{margin:10px 0 0;padding-left:26px;font-family:var(--sans);font-size:13.5px;
       line-height:1.6;opacity:.68;max-width:56ch}

  .foot{margin-top:52px;display:flex;justify-content:center;
        align-items:center;gap:18px}
  .foot .im2{font-style:italic;font-size:16.5px;opacity:.75}
  .foot .x{font-family:var(--sans);font-size:11px;opacity:.4}
  .foot .fslogo{width:128px;height:auto;display:block;opacity:.85}

  /* Interactive lockups (Randy): the Infinite Media wordmarks and the
     Fullstack logo are real links, keyboard focusable, with a visible focus
     ring. Scale is deliberately small so the editorial feel is untouched. */
  .lnk{color:inherit;text-decoration:none;display:inline-block;
       transform-origin:center center;border-radius:3px;
       transition:transform .22s ease,opacity .22s ease}
  .lnk:hover,.lnk:focus-visible{transform:scale(1.04);opacity:1}
  .lnk:focus-visible{outline:2px solid var(--gold);outline-offset:5px}
  /* masthead mark is left-aligned, so grow from its left edge or it drifts */
  .mark .lnk{transform-origin:left center}
  .foot .lnk{display:block}
  @media (prefers-reduced-motion:reduce){
    .lnk{transition:none}
    .lnk:hover,.lnk:focus-visible{transform:none}
  }

  @media (max-width:520px){
    .tline{flex-wrap:wrap}
    .tline .dots{display:none}
    .tkw{width:100%;padding-left:26px;margin-top:2px}
  }
</style>

<div class="wrap">

  <header>
    <div class="mark">
      <a class="im lnk" href="/infinitemedia">Infinite Media</a>
      <span class="kind">Shoot Brief</span>
    </div>
    <h1>[[CLIENT WORD ONE]] <em>[[CLIENT WORD TWO]]</em>
      <span class="no2">[[SUBTITLE, e.g. Shoot No. 2]]</span></h1>

    <p class="facts">
      <span class="k">Date</span><span class="v">[[DAY, MONTH D, YYYY]]</span><span class="sep">&middot;</span><span class="k">Time</span><span class="v">[[TIME]]</span><span class="sep">&middot;</span><span class="k">Format</span><span class="v">[[FORMAT]]</span><br>
      <span class="k">Location</span><span class="v">[[ADDRESS]]</span>
    </p>
  </header>

  <div class="sect"><i></i><span>[[SECTION, e.g. Video Topics]]</span><i></i></div>
  <p class="note">[[INSTRUCTION LINE]]</p>

  <!-- repeat per topic -->
  <div class="topic">
    <div class="tline"><span class="tno">01</span>
      <span class="tname">[[TOPIC NAME]]</span>
      <span class="dots"></span><span class="tkw">[[KEYWORD]]</span></div>
    <p class="why">[[ONE PARAGRAPH: what the viewer gets, in plain language.]]</p>
  </div>

  <div class="foot">
    <a class="im2 lnk" href="/infinitemedia">Infinite Media</a>
    <span class="x">&#215;</span>
    <a class="lnk" href="[[CLIENT URL]]" target="_blank" rel="noopener noreferrer" aria-label="[[CLIENT]], opens in a new tab">[[CLIENT LOGO SVG, class="fslogo"]]</a>
  </div>

</div>
```

## Published briefs

| Slug | Client | Shoot date |
|---|---|---|
| `fullstack-shoot-2` | Fullstack Lending | Aug 27, 2026 |
