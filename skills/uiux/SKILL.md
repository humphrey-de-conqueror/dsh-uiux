---
name: uiux
description: Design and build interfaces in a named visual style - fetch concrete token and component specs for a style, then review the result against a quality bar. Use when building or restyling a page, choosing a look, matching a brand aesthetic (liquid glass, minimalist, editorial, bento, cyberpunk, and dozens more), or when a UI looks generic and needs a committed visual point of view.
---

# UI/UX design

This skill routes design work through five tools that this plugin registers, plus the
reference files beside this one. The styles are authored specs, not adjectives: each one
carries color roles, type scale, spacing, radius, elevation, motion, and component recipes
that you copy directly instead of inventing values.

## Workflow

1. **Shortlist.** Call `uiux_styles` with the user's mood words, domain, and any style name
   they mentioned. Read the one-liners and `best for` columns. Pick two or three candidates
   that fit the content, not the ones with the prettiest names.
2. **Commit.** Call `uiux_spec` with the chosen slugs. Ask for `sections` you need
   (`tokens`, `type`, `components`, `motion`, `rules`, `a11y`, `platform`) and the output
   `format`:
   - `md` - read it, then write code.
   - `css` - paste the custom-property block into the stylesheet as-is.
   - `tailwind` - paste the `@theme` block (Tailwind v4 assumed).
   - `json` - feed a generator or another tool.
   If the user asked for a blend ("70% editorial, 30% bento", "editorial but calmer"), call
   `uiux_mix` instead — it returns one spec, weighted, with the dominant style's structure.
   Name the style or blend you applied in your reply so the user can ask for a different one.
   The **Style preview** tab in the right sidebar renders whatever you last fetched, so
   point the user there when they want to see the direction before you build. The
   **Style gallery** tab shows every style as a card; both are also in the composer's +
   menu as the `uiux-preview` and `uiux-gallery` commands.
3. **Build.** Use the style's tokens for every color, radius, space, shadow, and duration.
   Build components from the `components` section before inventing new ones. Every value in
   the spec exists for a reason; if you deviate, say which value and why.

   The spec's **composition** line is part of the style, not decoration: `poster` means rules
   and giant type in a grid, `glass` means floating translucent panels over a gradient,
   `terminal` means monospace rows in a framed screen, `bento` means unequal tiles, `soft`
   means one surface with paired shadows, `toy` means thick borders and hard offsets. A style
   poured into a generic card grid is a colour swap, and that is the failure mode this plugin
   exists to prevent.
4. **Check the platform.** Before shipping an interaction (dialog, tabs, carousel, sticky
   header, dark mode, form, animation, image priority), call `uiux_platform_guide` with
   `op: "search"` and the behavior you are implementing, then `op: "retrieve"` for the ids
   worth reading. These are Chrome's Modern Web Guidance rules - follow them over your own
   habits.
5. **Animate from the platform up.** Call `uiux_motion` with what the interface needs
   ("skeleton while the table loads", "shared element into the detail page") before adding
   any animation library. Recipes lead with native APIs - `popover` for menus,
   `startViewTransition` for shared elements, `animation-timeline: view()` for scroll
   reveal, CSS keyframes for skeletons and loaders - and each one includes the reduced-motion
   branch. When a recipe requires a dependency the project lacks (`spring-entrance` needs
   `motion`), check with `op: "probe"` and `dir`, then stop, install it, and continue; do not
   hand-roll what the recipe already solved.
6. **Review.** Work through `references/quality/web-interface-guidelines.md` before you call
   the work done. Fix what it flags; it is the difference between a styled page and a
   finished one.

## Rules that apply to every style

- **One direction, fully committed.** Half-applying a style reads as an accident. If the
  spec says 0 radius and hairline borders, nothing on the page gets 12px rounding.
- **Content first.** The style serves the interface's job. Never hide, shrink, or fake the
  user's actual data to make a composition work.
- **Use the tokens.** Do not restyle one component with raw hex values that are not in the
  palette; consistency is what makes a style read as a system.
- **Contrast is not optional.** The `a11y` section lists verified pairs. Any new pair you
  introduce (muted text on an elevated surface, text on a colored button) needs 4.5:1 for
  body text and 3:1 for large text or non-text indicators.
- **Dark mode is declared, not inverted.** Use the spec's dark palette. If it has none,
  derive one by keeping the accent and review contrast again.
- **Motion has a budget.** Respect `prefers-reduced-motion`, keep one entrance
  choreography, and never animate layout on scroll-driven content the user is reading.
- **Generic output is a failure.** Interchangeable card grids with a gradient hero and
  emoji icons are the default the model falls back to. If the result could belong to any
  other product, the style was not applied.

## Style families

The catalog is larger than this list; `uiux_styles` searches all of it, including aliases.

| Intent | Styles worth trying |
| --- | --- |
| Calm, premium, product-led | premium-minimalism, swiss-international, japandi |
| Depth, translucency, marketing | liquid-glass, glassmorphism, aurora |
| Loud, expressive, launch pages | neo-brutalism, maximalist-pop, cyberpunk, vaporwave |
| Crafted print and editorial | editorial, paper-print, monochrome-architecture |
| Systems, tools, dense data | data-dashboard, material-you, terminal-crt |
| Touchable, playful, soft | claymorphism, neumorphism, bento-grid |

## Content tiers

A spec is either `full` or `brief`.

- `full` - complete tokens, component recipes, do/don't rules, anti-patterns, verified
  contrast pairs. Use it as the source of truth.
- `brief` - palette, type, radius, and spacing only. Upstream `awesome-design-skills`
  supplied the style names; their palettes and type are authored here so brief styles are
  distinct rather than the same blue-on-white default repeated 59 times. Treat a brief style
  as a starting direction: keep its palette and geometry, then make the component and
  accessibility decisions yourself.

## Files

- `references/style-index.md` - every style with its one-liner, generated from the data
  files. Scan it when you want the full catalog in front of you without a tool call.
- `references/quality/web-interface-guidelines.md` - the review checklist. Read it.
- `references/quality/style-review.md` - a short pass/fail review for the visual direction
  itself.
- `references/upstream.md` - where the style data comes from, licenses, and how to refresh
  it when upstream publishes new styles.
