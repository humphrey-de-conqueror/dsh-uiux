# Upstream sources

Everything in this package either is authored here or is derived from one of two pinned
upstream repositories. Pinned revisions live in `scripts/vendor.mjs` and
`THIRD_PARTY_NOTICES.md`; both are refreshed with `npm run vendor`.

## awesome-design-skills

- Repository: <https://github.com/bergside/awesome-design-skills>
- Pinned revision: `f631a09b4fcc0166f2e2c1a8c81906ef680c57e8` (2026-06-28)
- License: MIT
- Vendored into `data/upstream/awesome-design-skills/` (git-ignored source material; the
  generated files under `data/styles/` are what ships).

Only the **style names and index** come from upstream. Upstream palettes were not reused:
roughly 75% of them are the same default (`#3B82F6` primary on white with `#111827` text) and
every brief sets Inter, so a direct conversion would have produced 59 near-identical styles.
Instead `data/brief-meta.json` authors a palette, type preset, and positioning for each name,
and `scripts/convert-brief.mjs` derives the rest of the token set.

Refresh procedure:

1. Update `UPSTREAM.awesomeDesignSkills` in `scripts/vendor.mjs` to the new revision.
2. Run `npm run vendor`, then `npm run build:briefs`.
3. Run `npm run validate`. New upstream slugs are refused by the converter until they get an
   entry in `data/brief-meta.json`; alias them in `ALIASES` when the concept already exists
   in the full tier.
4. Run `npm test`.

## web-interface-guidelines

- Repository: <https://github.com/vercel-labs/web-interface-guidelines>
- Pinned revision: `434b7f91364665f2f733b310ec54809bf8f37937` (2026-10-05)
- License: MIT
- Vendored into `skills/uiux/references/quality/web-interface-guidelines.md` with the
  original YAML frontmatter stripped and the argument placeholder replaced.

Refresh with `npm run vendor`; the command checks the recorded revision in the file header
when passed `--check`.

## Chrome Modern Web Guidance

- Package: `modern-web-guidance` (Apache-2.0), a dependency rather than vendored content.
- Run through its CLI by `src/mwg.js`; nothing from it is copied into this package.
- The tool `uiux_platform_guide` wraps `search`, `retrieve`, and `list`. Telemetry is
  disabled for every call.

`data/platform-guide-ids.json` records the 209 guide ids at build time so a style spec cannot
reference a guide that does not exist. Refresh it with:

```sh
node -e "import('./src/mwg.js').then(async m => { const ids = JSON.parse(await m.list()); })"
```

or regenerate from the package directly:

```sh
node node_modules/modern-web-guidance/skills/modern-web-guidance/modern-web.mjs list
```
