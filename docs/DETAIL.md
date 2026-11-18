# UI/UX styles

This plugin gives the agent a vocabulary for visual design direction, and the tokens to
execute it without inventing values. It ships one skill (`uiux`) and three tools.

## What it adds

| Surface | Name | Purpose |
| --- | --- | --- |
| Skill | `uiux` | Routes design work: shortlist a style, fetch its spec, build, check platform behaviour, review. |
| Tool | `uiux_styles` | Searches the catalog by mood words, domain, tags, or style name and returns a candidate table. |
| Tool | `uiux_spec` | Renders one or more styles as Markdown, CSS custom properties, a Tailwind v4 `@theme` block, or JSON. |
| Tool | `uiux_platform_guide` | Wraps Chrome's Modern Web Guidance: search 209 platform guides, then retrieve the ones that matter. |
| Client tab | `uiux-preview` | Right-sidebar pane that previews a style as a rendered demo page. |

The skill carries the workflow; the tools carry the data. A model that only sees the tool
descriptions can still use them, which is why the tools are always registered rather than
activated by a skill call.

## Style catalog

`data/styles/*.json` is the single source of truth: one file per style, loaded once at
startup. There is no separate index to drift out of sync.

Two tiers:

- **full** (20 styles) - complete specs: light and dark color roles, type roles and scale,
  spacing, radius, elevation, effects, motion, 5–6 component recipes with states, do/don't
  rules, anti-patterns, verified contrast pairs, and Modern Web Guidance ids relevant to
  the style.
- **brief** (59 styles) - palette, type, radius, spacing, and motion only. Names come from
  `bergside/awesome-design-skills`; palettes and positioning are authored here.

Full tier: aurora, bento-grid, claymorphism, cyberpunk, dark-luxury, data-dashboard,
editorial, glassmorphism, japandi, liquid-glass, material-you, maximalist-pop,
monochrome-architecture, neo-brutalism, neumorphism, paper-print, premium-minimalism,
swiss-international, terminal-crt, vaporwave.

`skills/uiux/references/style-index.md` lists every style with its one-liner and is generated
from the same files by `npm run build:index`.

## Tools in detail

### `uiux_styles`

Parameters: `query`, `tags`, `depth`, `limit`. The query is tokenised (CJK-safe) and scored
against slug, name, aliases, tags, mood, best-for, and one-liner. Aliases let
`glassmorphism`, `frosted glass`, `bento`, `新拟态`, and `赛博朋克` reach the right style.

### `uiux_spec`

Parameters: `slugs` (required), `sections`, `format`, `maxBytes`. Sections are
`overview`, `tokens`, `type`, `components`, `motion`, `rules`, `a11y`, `platform`,
`sources`.

Output formats:

- `md` - the full spec as readable Markdown, for a model that is about to write code.
- `css` - `:root` custom properties plus a `[data-theme="dark"]` block and a
  `prefers-reduced-motion` block. All names are kebab-case (`--uiux-color-surface-alt`).
- `tailwind` - the same tokens as a Tailwind v4 `@theme` block.
- `json` - the section data for a generator.

Every format honours a byte budget and, when it truncates, says which sections were dropped
instead of silently cutting mid-sentence.

### `uiux_platform_guide`

Parameters: `op` (`search`, `retrieve`, `list`), `query`, `ids`. Backed by the
`modern-web-guidance` npm package, executed as a subprocess with telemetry disabled. Its
`retrieve` output can exceed a comfortable tool result, so responses are truncated with an
explicit marker.

## Preview, gallery, and page tabs

The client half (`client.js`) registers three right-sidebar tab types, `uiux-preview`,
`uiux-gallery`, and `uiux-page`, each with a guide entry so all three are reachable from the
sidebar's add menu. It also registers the `uiux-preview`, `uiux-gallery`, and `uiux-page`
commands, so the composer's + menu opens any pane without leaving the keyboard.

The preview pane shows a style dropdown, a light/dark toggle, three stage widths (full, 768,
390), a follow toggle, a reload button, and an iframe with the page. The pane adopts each style's
`preferredScheme` when you pick one, and keeps your manual light/dark choice for that style. It follows the agent:
every `uiux_spec` call records its slugs on the host, the pane polls `state.json`, and a
revision bump adopts the first slug unless you picked a style in the gallery.

The gallery pane paints all 79 styles as cards, each with a thumbnail (`thumb.svg?slug=`) that
reuses one wireframe — header bar, `Aa` hero, measure lines, accent action, three cards — painted
from that style's own tokens. Every style declares `preferredScheme`, authored for the full tier
and derived from `data/brief-meta.json` for briefs, so dark-first styles (Cyberpunk, Aurora,
Terminal CRT, …) show dark, and the preview page opens in the native scheme until you toggle it. Clicking a card pins that style, opens the preview
pane, and primes the composer with the request (`Use the Editorial style (\`editorial\`) …`)
through the session's own input facade, so the agent learns the pick from a normal message. A
hand-written draft is left alone and the user is told to clear it. The preview header's **Ask
agent** button sends the same request immediately via `ctx.sessions.scope(id).conversation.send`.

The preview header carries two more controls. **Design** opens live sliders for accent colour,
rounding, spacing, and type scale; they are sent as query parameters and rendered by
`previewPage()` as an override block appended after the style's CSS, touching only the accent
pair, the radius scale, the spacing scale, and type sizes. **Compare** renders two styles side by
side at the same theme, width, and tweaks. Tweaks never touch the catalog: they are a preview
affordance, and the spec the agent copies stays authoritative.

## Your page

`uiux-page` previews work in progress. The pane takes an absolute path or an http(s) URL; a
directory opens its `index.html`; the last value is remembered in `localStorage`.

`GET /dsh-uiux/preview/file.html?path=<abs>` reads the page and injects
`<base href="/dsh-uiux/preview/fs/<rootToken>/">` after `<head>`, so the page's own relative
assets resolve through `GET /dsh-uiux/preview/fs/<rootToken>/<rel>` (a `kind: 'prefix'` route).
That asset route refuses `..` segments, dot-paths (`.git`, `.env`), paths that resolve outside
the root, extensions outside a fixed MIME allowlist, and files above `MAX_FILE_BYTES` (24 MiB),
and sends `Cache-Control: no-store`. The iframe carries `sandbox="allow-scripts allow-same-origin
allow-forms allow-popups allow-modals"` because a page under development needs its scripts. This
route reads files as the host user can read them: it is a local development affordance on an
authenticated localhost port, not a general file server.

Both panes receive their session through the registration's `inject: (sessionId) => ({ sessionId })`:
`sidebar.right.pane.tab` is a session-scoped slot, so the framework hands the id to the body.

No iframes are involved in the gallery, so 79 styles cost one JSON request.

Content comes from four exact host routes:

| Route | Purpose |
| --- | --- |
| `GET /dsh-uiux/preview/page.html?slug=&theme=&width=` | The demo page, composed from `uiux_spec` CSS output. |
| `GET /dsh-uiux/preview/styles.json` | Picker rows for the whole catalog. |
| `GET /dsh-uiux/preview/state.json` | Last spec slugs, revision, and the default style. |
| `GET /dsh-uiux/preview/gallery.json` | Gallery cards: both palettes, type faces, radius, depth, thumbnail URL. |
| `GET /dsh-uiux/preview/thumb.svg?slug=&scheme=` | One style's gallery thumbnail, painted from its tokens. |
| `GET /dsh-uiux/preview/file.html?path=` | A page you are building, with a base element for its assets. |
| `GET /dsh-uiux/preview/fs/<rootToken>/<path>` | That page's assets, served from its own folder. |

The client half ships as plain JavaScript — no build step, same loader format as DSH's own
client plugins. A newly added `dsh.client` manifest field is picked up when the host boots,
so the tabs appear after a restart, not after a reinstall.

## Configuration

Set options in the bundle patch in your `cordis.yml`:

```yaml
- id: uiux
  name: dsh-uiux
  config:
    platformGuidance: true
    maxSpecBytes: 24000
    maxListRows: 40
```

| Option | Default | Meaning |
| --- | --- | --- |
| `platformGuidance` | `true` | Register `uiux_platform_guide`. Set `false` when the dependency is not installed. |
| `maxSpecBytes` | `24000` | Upper bound for one `uiux_spec` response. |
| `maxListRows` | `40` | Upper bound for rows returned by `uiux_styles`. |
| `dataRoot` | packaged `data/` | Absolute path to a directory containing `styles/`, for a custom catalog. |

Unknown options and out-of-range values throw at load, so a typo fails loudly instead of
being ignored.

## Layout

```
index.js                  plugin entry: validate config, load catalog, register tools, routes, and skill
client.js                 client half: the right-sidebar preview tab
src/config.js             option validation and defaults
src/catalog.js            load and rank styles
src/render.js             markdown, css, tailwind, json renderers with byte caps
src/tools.js              the three tool definitions
src/mwg.js                Modern Web Guidance subprocess adapter with an LRU cache
src/skill-provider.js     the uiux skill provider
src/preview.js            demo page composition and picker rows
src/preview-state.js      last-spec slugs and the revision the pane polls
src/routes.js             the three preview routes
data/styles/*.json        one file per style
data/brief-meta.json      authored palettes for brief styles
data/platform-guide-ids.json  valid guide ids, used by the validator
skills/uiux/              SKILL.md and reference pages
scripts/validate.mjs      schema, contrast, and guide-id gate
scripts/convert-brief.mjs brief tier generator
scripts/build-index.mjs   reference index generator
scripts/vendor.mjs        pinned upstream downloader
```

## Development

```sh
npm run validate      # schema, WCAG contrast, guide ids, index freshness
npm test              # unit tests
npm run build:briefs  # regenerate brief styles and the index
npm run vendor        # refresh pinned upstream sources
```

Contrast is enforced mechanically: `scripts/validate.mjs` parses hex (including alpha),
composites translucent surfaces over the actual backdrop, and fails any declared pair below
4.5:1 in either color scheme.

## Licenses

MIT for this package. Style names and the review checklist come from MIT upstreams; Chrome
Modern Web Guidance is Apache-2.0 and used as a dependency, not copied. See
`THIRD_PARTY_NOTICES.md` and `skills/uiux/references/upstream.md`.
