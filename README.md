# dsh-uiux

Design-direction plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).
It gives the agent named visual styles with implementation-ready tokens, the platform rules
to build them correctly, and a review bar to hold the result to.

The problem it solves is generic output: ask a model for a page and you get the same
Inter-on-white card grid with a gradient hero. This plugin replaces adjectives with specs —
color roles, type scales, spacing, radius, elevation, motion, and component recipes that are
copied rather than invented.

## Install

```sh
# from the repository root, with the harness running
dsh plugin install link:/home/humphrey-de-conqueror/dsh-uiux
```

Or through the Plugin Manager: **Install bundle**, target
`link:/home/humphrey-de-conqueror/dsh-uiux`. Restart or reload the session; the `uiux` skill
appears in the skill catalog and the three tools become available.

## Use

Ask for a direction in ordinary language:

> Build the pricing page in the editorial style.

> Make this dashboard feel like a terminal, but keep it readable.

> I want the liquid glass look for the onboarding flow.

The skill routes the work: search the catalog, fetch the spec, build with its tokens, check
interaction guidance, then review. You can also call the tools directly:

| Tool | Use |
| --- | --- |
| `uiux_styles` | Find styles by mood, domain, or name. |
| `uiux_spec` | Get one or more styles as Markdown, CSS, Tailwind v4, or JSON. |
| `uiux_platform_guide` | Search Chrome's Modern Web Guidance, then retrieve the guides that matter. |

## How to use it

[docs/GUIDE.md](docs/GUIDE.md) splits the plugin into what runs on its own (the skill and the
three tools) and what you drive by hand (the three panes, the + menu, the gallery-to-composer
path). Read that first.

## Preview

Open **Style preview** from the right sidebar's add menu (or the sidebar guide page) to see
a style rendered as a small demo page, without opening any file.

The tab follows the agent: each time `uiux_spec` runs, the preview adopts the first style in
that spec set. Pick another style from the dropdown to pin it, toggle light/dark, switch the
stage width to check responsiveness, reload, or open the page in its own tab.

The demo page is built from the same CSS custom properties `uiux_spec` returns, so the
preview cannot drift from the spec.

Two more controls on the same pane:

- **Design** opens live sliders for the accent colour, rounding, spacing, and type scale. They
  are applied as an override block over the style's own tokens, so you can audition a variation
  before asking for it — the tweaks are visible only in the preview and never change the spec.
- **Compare** shows two styles side by side at the same theme, width, and tweaks.

## Your page

**Your page** previews something you are actually building. Type an absolute path to an HTML
file — or a directory, which opens its `index.html` — or a local dev server URL, and press
**Load**. The last path is remembered.

Local files are served from their own folder, so relative `./style.css`, images, and `./app.js`
resolve exactly as they do when you open the file in a browser. Paths outside that folder,
dot-paths such as `.git` or `.env`, and non-asset extensions are refused.

All three panes are also one click away from the composer's **+** menu as the `uiux-preview`,
`uiux-gallery`, and `uiux-page` commands.

## Gallery

**Style gallery** shows all 79 styles as cards with a filter box. Each card frames the style's
real page in miniature, mounted only when it scrolls into view, so the composition shows — a
Swiss poster, a glass panel stack, a terminal — and not just the palette. Dark-first styles frame
their dark page. Clicking a card opens it in the preview tab (in its native scheme) and puts a
one-line style request into the composer: press Enter to ask for it, or use **Ask agent** in the
preview header to send it straight away. A draft you typed is never overwritten. Rows come from
`/dsh-uiux/preview/gallery.json`; the frames are `/dsh-uiux/preview/page.html`, so there are no
image assets and no build step.

## What is inside

- **20 full styles** with complete token sets, component recipes, do/don't rules,
  anti-patterns, and contrast-verified palettes in light and dark.
- **59 brief styles** carrying an authored palette and positioning.
- **A review rubric** adapted from `vercel-labs/web-interface-guidelines`, plus a
  style-specific pass/fail review.
- **Chrome Modern Web Guidance** wrapped as a tool, so interaction behaviour comes from a
  maintained platform source rather than model habit.
- **Three right-sidebar tabs**: the style the agent last worked on, a gallery of every style,
  and a preview of a page you are building.

Full tier: aurora, bento-grid, claymorphism, cyberpunk, dark-luxury, data-dashboard,
editorial, glassmorphism, japandi, liquid-glass, material-you, maximalist-pop,
monochrome-architecture, neo-brutalism, neumorphism, paper-print, premium-minimalism,
swiss-international, terminal-crt, vaporwave.

## Example

```sh
node --input-type=module -e "
import { loadCatalog, rankStyles } from './src/catalog.js'
import { renderSpec } from './src/render.js'
const catalog = loadCatalog(new URL('./data/', import.meta.url).pathname)
const [entry] = rankStyles(catalog, { query: 'glass' })
console.log(renderSpec(entry, { format: 'css' }))
"
```

## Configuration

```yaml
- id: uiux
  name: dsh-uiux
  config:
    platformGuidance: true   # register uiux_platform_guide
    maxSpecBytes: 24000      # per-response byte budget for uiux_spec
    maxListRows: 40          # row cap for uiux_styles
```

Unknown options and invalid values throw at load. See [docs/DETAIL.md](docs/DETAIL.md) for
the full description of the tools, the data model, and the layout.

## Development

```sh
npm run validate      # schema, contrast, guide ids, generated index freshness
npm test              # unit tests
npm run build:briefs  # regenerate brief styles from data/brief-meta.json
npm run build:index   # regenerate skills/uiux/references/style-index.md
npm run vendor        # refresh pinned upstream sources
npm run build:examples # regenerate examples/*.html from the current tokens
```

The three pages in `examples/` are generated: their CSS is exactly
`uiux_spec` `format: "css"` output for `liquid-glass`, `editorial`, and
`data-dashboard`, so they double as a visual check on the catalog.

`node_modules/` and the downloaded upstream snapshots in `data/upstream/` are
ignored; `npm run vendor` restores the snapshots at the pinned revisions.

Adding a style means adding one file to `data/styles/`. The catalog, the tools, and the
generated index all read from that directory; there is nothing else to update.

## Licenses

MIT. Style names come from MIT-licensed `awesome-design-skills`; the review checklist from
MIT-licensed `vercel-labs/web-interface-guidelines`; Chrome Modern Web Guidance
(Apache-2.0) is used as a dependency. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
