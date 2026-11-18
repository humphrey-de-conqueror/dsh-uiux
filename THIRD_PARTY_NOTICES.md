# Third-party notices

`dsh-uiux` is MIT licensed. It derives names, text, or runtime behaviour from the projects
below.

## bergside/awesome-design-skills

- Source: <https://github.com/bergside/awesome-design-skills>
- Revision: `f631a09b4fcc0166f2e2c1a8c81906ef680c57e8`
- License: MIT
- Used for: style names and upstream style index. The 59 brief-tier entry names come from
  this catalog; their palettes, type presets, and positioning are authored for `dsh-uiux`
  and recorded in `data/brief-meta.json`.

## vercel-labs/web-interface-guidelines

- Source: <https://github.com/vercel-labs/web-interface-guidelines>
- Revision: `434b7f91364665f2f733b310ec54809bf8f37937`
- License: MIT
- Used for: `skills/uiux/references/quality/web-interface-guidelines.md`, vendored with the
  frontmatter removed and the argument placeholder replaced by an instruction sentence.

## Google Chrome Modern Web Guidance

- Source: <https://github.com/GoogleChrome/modern-web-guidance>
- Package: `modern-web-guidance` (Apache-2.0), declared as a dependency.
- Used for: the `uiux_platform_guide` tool, which invokes the package's CLI. No guide
  content is copied into this repository. `data/platform-guide-ids.json` records the set of
  guide ids so style specs can be validated against it.

## Fonts referenced in style specs

Style specs name typefaces by family (`Fraunces`, `Instrument Sans`, `Space Grotesk`,
`Michroma`, and others). No font files are bundled. Each is available from Google Fonts or
its foundry under that project's own license; the consuming project is responsible for
licensing and self-hosting them.
