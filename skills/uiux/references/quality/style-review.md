# Style review

A pass/fail review for the visual direction, run after the interface works and before you
report it done. Each line is a check with the evidence that satisfies it. If a check fails,
fix it or state why it does not apply.

## 1. The style is identifiable

- Name three properties someone could point at to say which style this is: the radius rule,
  the border or elevation rule, the type pairing, the accent, the density.
- If you removed all copy and images, would the empty page still read as that style? A
  grayscale screenshot should be recognizably this system, not a neutral wireframe.
- Fail: the page would look the same under two different styles.

## 2. Tokens are the only source of visual values

- Every color resolves to a role in the spec (`bg`, `surface`, `surfaceAlt`, `text`,
  `textMuted`, `border`, `accent`, `accentText`, plus status roles).
- Every radius, shadow, spacing step, and duration comes from the spec's scales.
- No component redefines a token locally to look better in isolation.
- Fail: raw hex values, one-off `rgba()` shadows, or a second accent hue.

## 3. Hierarchy is legible

- One element is unmistakably primary per view. The eye lands there first without color.
- Type delivers hierarchy through size, weight, and spacing, not through five colors.
- Body copy line length stays between 55 and 80 characters; display type is allowed to be
  tighter or wider than that.
- Numbers in tables and metrics use tabular figures and align on the decimal.
- Fail: three equally loud buttons, or a heading that is only 2px larger than the body.

## 4. Spacing is systematic

- Section rhythm repeats: same top and bottom gap between like sections.
- Component padding matches the spec's density; nothing is tightened to fit a design idea.
- Nothing touches the viewport edge without intent; nothing floats in an accidental gap.
- Fail: mixed 16/18/20px gaps that no scale explains.

## 5. States are complete

Every interactive element has: default, hover, focus-visible, active, disabled, and where
relevant loading, error, and empty.

- Focus is visible against both the surface and an adjacent accent fill.
- Disabled keeps 4.5:1 on text if the text must be read, otherwise use a muted role plus
  `aria-disabled` rather than dropping contrast to nothing.
- Empty states say what happened and what to do next; they are not a blank panel.
- Fail: hover-only affordances, focus rings removed with `outline: none`.

## 6. Motion is deliberate

- One entrance choreography, reused. Durations from the spec.
- Motion communicates state change or spatial relationship; it never delays reading.
- `prefers-reduced-motion` is honored with an instant or opacity-only variant.
- Fail: scroll-triggered animation on body copy, continuously looping decorative motion,
  hover transitions on everything with the same duration.

## 7. The content is real

- Labels, numbers, and units come from the user's domain; placeholders are marked as such.
- No lorem ipsum, no "Sample title 1", no fake metrics presented as real.
- Long states are designed: long names, zero items, 10k-item lists, error text that wraps.
- Fail: a demo that only works with three short English words.

## 8. Accessibility holds under the style

- Contrast pairs match the spec's verified list; any new pair is checked.
- Keyboard order follows the visual order; custom widgets have roles and keys.
- Decorative translucency, grain, and glow never sit under small text.
- Zoom to 200% keeps the layout usable.
- Fail: a glass card with 11px muted text at 60% opacity.

## 9. Responsive is designed, not squeezed

- The layout has breakpoints chosen for the content, not only the default framework stops.
- Dense tables disclose progressively instead of shrinking type below 14px.
- Touch targets are at least 44×44 CSS pixels where the style allows.
- Fail: a desktop grid that stacks into one column of full-width cards on mobile with no
  hierarchy change.

## 10. The result is not the model default

Compare against the page you would have produced with no style at all. List what changed:
type, palette, geometry, density, motion, or copy voice. If the list is empty, the style was
described in the reply but not built.
