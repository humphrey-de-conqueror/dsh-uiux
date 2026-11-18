# Using dsh-uiux

Two halves: things the agent reaches for on its own, and things you reach for by hand.
Nothing here needs a terminal.

---

## Passive — what runs without you

### The `uiux` skill

It sits in the skill catalog with a description about building or restyling interfaces in a
named visual style. When your request matches — "make this page editorial", "this dashboard
looks generic", "pick a look for the landing page" — the agent loads it and follows its
workflow: shortlist styles, commit to one, fetch its spec, build with the tokens, check
interaction behaviour, then review the result.

You never have to name the skill. You can, if you want: `skill uiux`.

### Three tools

Always in the agent's toolbox, no menu, no setup:

| Tool | What the agent does with it |
| --- | --- |
| `uiux_styles` | Searches 79 styles by name, mood, or domain ("calm fintech dashboard"). |
| `uiux_spec` | Returns a style's concrete tokens and component recipes as Markdown, CSS, Tailwind v4, or JSON. |
| `uiux_platform_guide` | Searches Chrome's Modern Web Guidance and retrieves the guide for an interaction (dialogs, tabs, scroll, animation). |

The third one is why the plugin does not invent platform behaviour: when the agent needs to
build a dialog, it reads the maintained guidance instead of guessing.

### The preview follows the agent

Every `uiux_spec` call records the styles it returned. The preview tab notices the revision
change and adopts the first style — so while the agent works, the preview becomes the thing it
is about to build, without you picking anything.

### The routes

The tabs, cards, thumbnails, and file preview are all served by the plugin itself. No build
step runs when you open one, and no page is generated ahead of time.

---

## Active — what you can play with

### The + menu

In the composer, **+** lists three entries from this plugin:

- **Style preview** — the style the agent last worked on, in a stage you can resize.
- **Style gallery** — all 79 styles as cards.
- **Your page** — a page you are building.

The same three are in the right sidebar's add menu, so they can sit beside your chat.

### Gallery → pick → ask

Filter the gallery, click a card. It opens the style in the preview **and** writes a one-line
request into the composer:

```
Use the Editorial style (`editorial`) for this UI. Call uiux_spec for its tokens, build to
them, and review the result against the checklist.
```

Press Enter and the agent takes it from there. A draft you typed is never overwritten — the
tab tells you to clear it instead. If you would rather skip the composer, **Ask agent** in the
preview header sends it immediately.

### Preview controls

| Control | What it does |
| --- | --- |
| Style dropdown | Pin any style; the preview stops following the agent. |
| Light / Dark | Switch scheme. Each style opens in its own native scheme first. |
| Full / 768 / 390 | Stage width, for checking responsiveness. |
| **Design** | Live sliders: accent colour, rounding, spacing, type scale. |
| **Compare** | Two styles side by side at the same theme, width, and tweaks. |
| Follow agent | On by default; turn it off to keep your own pick while the agent works. |
| Reload | Re-render (useful after editing a style file). |
| Ask agent | Send the current style request now. |
| Open | The page in its own browser tab. |

**Design** is an audition, not an edit: the sliders render an override block over the style's
own tokens, so you can see "same layout, warmer accent, less rounding" before asking for it.
The spec the agent copies stays authoritative — tweaks never leak into it.

### Your page

Type an absolute path to an HTML file, or a folder (it opens its `index.html`), or a local dev
server URL, and press **Load**. The last path is remembered.

Relative `./style.css`, images, and scripts resolve from the page's own folder, so what you see
is what the browser would show. Paths outside that folder, dot-paths like `.git` or `.env`,
unknown file types, and files over 24 MiB are refused with a message.

### Ask in plain language

The plugin is not a menu you must click through. These all work:

- "Make the settings page liquid glass."
- "I want something calmer than this — suggest two styles and build the first."
- "This looks like every other dashboard. Pick a point of view and apply it."
- "Preview the page I'm building at ~/project/index.html."

The agent shortlists, fetches the spec, and builds; you watch in the preview tab.

---

## A 60-second tour

1. Ask: *"Pick a style for a finance dashboard and build a small example."*
2. The preview tab opens on the style the agent chose.
3. Open the **gallery**, click a different card — the composer fills with a style request.
4. Press Enter, then open **Design** and drag the accent slider to see where it could go.
5. Open **Your page** and point it at something you are building.

---

## Limits worth knowing

- **Design tweaks do not travel** to the agent. Say what you liked, or ask for the variation in
  words.
- **Compare** compares styles, not your page against a style.
- **Your page** previews local files and local dev servers. Remote sites often refuse to be
  framed, and are not fetched through the plugin.
- **Thumbnails** are painted from tokens, not screenshots — accurate about colour, type, and
  shape, not about a specific layout.
