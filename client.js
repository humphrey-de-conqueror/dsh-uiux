/**
 * dsh-uiux — client half: a preview tab and a gallery tab in the right sidebar,
 * plus two composer commands so both are one click away from the "+" menu.
 *
 * Format: the loader's lazy CommonJS wrapper, same as DSH's own client plugins, so
 * there is no build step. Everything shown comes from the host routes in
 * `src/routes.js`; this file only fetches JSON, paints cards, and points an iframe at
 * `/dsh-uiux/preview/page.html`.
 *
 * The preview follows the agent: whenever `uiux_spec` runs, the host bumps a revision
 * and the pane adopts the first slug of that spec set. Picking a style in the gallery
 * pins that style instead.
 */
window.__ModuleLoader__.load({
  id: 'dsh-uiux',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    var PREVIEW_ID = 'dsh-uiux/preview'
    var PREVIEW_KIND = 'uiux-preview'
    var GALLERY_ID = 'dsh-uiux/gallery'
    var GALLERY_KIND = 'uiux-gallery'
    var PAGE_URL = '/dsh-uiux/preview/page.html'
    var STYLES_URL = '/dsh-uiux/preview/styles.json'
    var STATE_URL = '/dsh-uiux/preview/state.json'
    var GALLERY_URL = '/dsh-uiux/preview/gallery.json'
    var POLL_MS = 2500
    var WIDTHS = [
      { value: 'auto', label: 'Full' },
      { value: 'tablet', label: '768' },
      { value: 'phone', label: '390' },
    ]

    var BORDER = 'var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.28))'
    var SURFACE = 'var(--dsw-alias-bg-primary, transparent)'
    var MUTED = 'var(--dsw-alias-text-tertiary, rgba(127, 127, 127, 0.9))'

    /** The style the gallery pinned. Module state: both panes live in this bundle. */
    var pinned = { slug: '', listeners: new Set() }

    function selectStyle(slug) {
      pinned.slug = slug
      pinned.listeners.forEach(function (listener) { listener(slug) })
    }

    function subscribeStyle(listener) {
      pinned.listeners.add(listener)
      return function () { pinned.listeners.delete(listener) }
    }

    function controlStyle(active) {
      return {
        font: 'inherit',
        fontSize: 12,
        lineHeight: '20px',
        padding: '3px 8px',
        borderRadius: 6,
        border: '1px solid ' + BORDER,
        background: active ? 'var(--dsw-alias-bg-tertiary, rgba(127, 127, 127, 0.16))' : 'transparent',
        color: 'inherit',
        cursor: 'pointer',
      }
    }

    /**
     * The preview pane: one style rendered as a page, with controls.
     * @returns {import('react').ReactElement} pane content.
     */
    function PreviewPanel() {
      var stylesState = React.useState([])
      var styles = stylesState[0]
      var setStyles = stylesState[1]
      var slugState = React.useState('')
      var slug = slugState[0]
      var setSlug = slugState[1]
      var themeState = React.useState('light')
      var theme = themeState[0]
      var setTheme = themeState[1]
      var widthState = React.useState('auto')
      var width = widthState[0]
      var setWidth = widthState[1]
      var followState = React.useState(true)
      var follow = followState[0]
      var setFollow = followState[1]
      var nonceState = React.useState(0)
      var nonce = nonceState[0]
      var setNonce = nonceState[1]
      var errorState = React.useState('')
      var error = errorState[0]
      var setError = errorState[1]

      var followRef = React.useRef(true)
      var revisionRef = React.useRef(-1)

      React.useEffect(function () {
        followRef.current = follow
      }, [follow])

      React.useEffect(function () {
        var cancelled = false
        fetch(STYLES_URL)
          .then(function (response) { return response.json() })
          .then(function (payload) {
            if (cancelled) return
            setStyles(payload.styles || [])
            setSlug(function (previous) {
              return previous || payload.defaultSlug || (payload.styles && payload.styles[0] && payload.styles[0].slug) || ''
            })
          })
          .catch(function (cause) {
            if (!cancelled) setError(String((cause && cause.message) || cause))
          })
        return function () { cancelled = true }
      }, [])

      React.useEffect(function () {
        return subscribeStyle(function (next) {
          if (!next) return
          setSlug(next)
          setNonce(function (value) { return value + 1 })
        })
      }, [])

      React.useEffect(function () {
        var cancelled = false
        function tick() {
          if (document.visibilityState === 'hidden') return
          fetch(STATE_URL)
            .then(function (response) { return response.json() })
            .then(function (payload) {
              if (cancelled) return
              var next = payload.revision
              if (next === revisionRef.current) return
              revisionRef.current = next
              if (followRef.current && payload.slugs && payload.slugs.length > 0) {
                setSlug(payload.slugs[0])
                setNonce(function (value) { return value + 1 })
              }
            })
            .catch(function () { /* host route not ready yet; the next tick retries */ })
        }
        tick()
        var timer = setInterval(tick, POLL_MS)
        return function () {
          cancelled = true
          clearInterval(timer)
        }
      }, [])

      var pageUrl = slug === ''
        ? ''
        : PAGE_URL + '?slug=' + encodeURIComponent(slug) + '&theme=' + theme + '&width=' + width + '&v=' + nonce

      var options = styles.map(function (entry) {
        return h('option', { key: entry.slug, value: entry.slug }, entry.name + (entry.depth === 'brief' ? ' ·' : ''))
      })

      var header = h('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          padding: '6px 8px',
          borderBottom: '1px solid ' + BORDER,
          background: SURFACE,
        },
      }, [
        h('select', {
          key: 'style',
          value: slug,
          onChange: function (event) { setSlug(event.target.value) },
          style: Object.assign(controlStyle(false), { maxWidth: 200, flex: '1 1 140px' }),
          'aria-label': 'Style',
        }, options),
        h('div', { key: 'theme', style: { display: 'flex', gap: 4 } }, [
          h('button', {
            key: 'light',
            type: 'button',
            style: controlStyle(theme === 'light'),
            onClick: function () { setTheme('light') },
          }, 'Light'),
          h('button', {
            key: 'dark',
            type: 'button',
            style: controlStyle(theme === 'dark'),
            onClick: function () { setTheme('dark') },
          }, 'Dark'),
        ]),
        h('div', { key: 'width', style: { display: 'flex', gap: 4 } }, WIDTHS.map(function (item) {
          return h('button', {
            key: item.value,
            type: 'button',
            style: controlStyle(width === item.value),
            onClick: function () { setWidth(item.value) },
            title: item.value === 'auto' ? 'Fill the pane' : item.label + ' pixels wide',
          }, item.label)
        })),
        h('button', {
          key: 'follow',
          type: 'button',
          style: controlStyle(follow),
          onClick: function () { setFollow(!follow) },
          title: 'Adopt the style the agent last asked for',
        }, 'Follow agent'),
        h('button', {
          key: 'reload',
          type: 'button',
          style: controlStyle(false),
          onClick: function () { setNonce(function (value) { return value + 1 }) },
          title: 'Reload the preview',
        }, 'Reload'),
        pageUrl === '' ? null : h('a', {
          key: 'open',
          href: pageUrl,
          target: '_blank',
          rel: 'noreferrer',
          style: { fontSize: 12, color: MUTED, marginLeft: 'auto' },
        }, 'Open'),
      ])

      var body = error !== ''
        ? h('div', { style: { padding: 16, fontSize: 13, color: MUTED } }, 'Preview routes are unavailable: ' + error)
        : pageUrl === ''
          ? h('div', { style: { padding: 16, fontSize: 13, color: MUTED } }, 'Loading styles…')
          : h('div', {
            style: {
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              justifyContent: 'center',
              background: 'var(--dsw-alias-bg-secondary, transparent)',
              padding: width === 'auto' ? 0 : '8px 0',
            },
          }, h('iframe', {
            key: pageUrl,
            src: pageUrl,
            title: 'Style preview',
            style: {
              width: width === 'auto' ? '100%' : (width === 'phone' ? 390 : 768),
              height: '100%',
              border: '1px solid ' + (width === 'auto' ? 'transparent' : BORDER),
              borderRadius: width === 'auto' ? 0 : 8,
              background: '#fff',
            },
          }))

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' },
      }, [header, body])
    }

    /**
     * One gallery card: the style's two palettes, its faces, and where it belongs.
     * @param {{ entry: object, onPick: (slug: string) => void }} props - row data and pick handler.
     * @returns {import('react').ReactElement} card.
     */
    function GalleryCard(props) {
      var entry = props.entry
      var light = entry.light
      var dark = entry.dark
      var strip = function (colors, label) {
        return h('div', {
          style: {
            background: colors.bg,
            color: colors.text,
            borderBottom: '1px solid ' + colors.border,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minHeight: 54,
          },
        }, [
          h('span', {
            key: 'aa',
            style: {
              fontFamily: entry.display + ', ' + entry.body + ', system-ui, sans-serif',
              fontSize: 20,
              lineHeight: 1,
              fontWeight: 600,
            },
          }, 'Aa'),
          h('span', {
            key: 'chip',
            style: {
              background: colors.accent,
              color: colors.accentText,
              borderRadius: entry.radius,
              fontSize: 10,
              lineHeight: '16px',
              padding: '0 6px',
            },
          }, 'Action'),
          h('span', {
            key: 'dot',
            style: {
              marginLeft: 'auto',
              width: 8,
              height: 8,
              borderRadius: 999,
              background: colors.surface,
              border: '1px solid ' + colors.border,
            },
            title: label + ' surface',
          }),
        ])
      }

      return h('button', {
        type: 'button',
        onClick: function () { props.onPick(entry.slug) },
        style: {
          display: 'block',
          textAlign: 'left',
          padding: 0,
          width: '100%',
          border: '1px solid ' + BORDER,
          borderRadius: 10,
          overflow: 'hidden',
          background: SURFACE,
          color: 'inherit',
          cursor: 'pointer',
          font: 'inherit',
        },
        title: entry.oneLiner,
      }, [
        strip(light, 'Light'),
        strip(dark, 'Dark'),
        h('div', { key: 'meta', style: { padding: '8px 10px 10px' } }, [
          h('div', { key: 'name', style: { fontSize: 13, fontWeight: 600, lineHeight: '18px' } }, entry.name),
          h('div', {
            key: 'one',
            style: {
              fontSize: 11,
              color: MUTED,
              lineHeight: '15px',
              maxHeight: 30,
              overflow: 'hidden',
            },
          }, entry.oneLiner),
          h('div', { key: 'depth', style: { fontSize: 10, color: MUTED, marginTop: 4 } },
            entry.depth === 'full' ? 'Complete spec' : 'Palette only'),
        ]),
      ])
    }

    /**
     * The gallery pane: every style as a card, filtered by text.
     * @returns {import('react').ReactElement} pane content.
     */
    function GalleryPanel() {
      var rowsState = React.useState([])
      var rows = rowsState[0]
      var setRows = rowsState[1]
      var filterState = React.useState('')
      var filter = filterState[0]
      var setFilter = filterState[1]
      var errorState = React.useState('')
      var error = errorState[0]
      var setError = errorState[1]

      React.useEffect(function () {
        var cancelled = false
        fetch(GALLERY_URL)
          .then(function (response) { return response.json() })
          .then(function (payload) { if (!cancelled) setRows(payload.styles || []) })
          .catch(function (cause) { if (!cancelled) setError(String((cause && cause.message) || cause)) })
        return function () { cancelled = true }
      }, [])

      var needle = filter.trim().toLowerCase()
      var visible = needle === ''
        ? rows
        : rows.filter(function (entry) {
          return (entry.slug + ' ' + entry.name + ' ' + entry.oneLiner).toLowerCase().indexOf(needle) !== -1
        })

      var pick = function (slug) {
        selectStyle(slug)
        if (client !== null) client.sidebarRight.openTab(PREVIEW_KIND)
      }

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' },
      }, [
        h('div', {
          key: 'bar',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            borderBottom: '1px solid ' + BORDER,
            background: SURFACE,
          },
        }, [
          h('input', {
            key: 'filter',
            value: filter,
            onChange: function (event) { setFilter(event.target.value) },
            placeholder: 'Filter styles',
            style: Object.assign(controlStyle(false), { flex: '1 1 auto', cursor: 'text' }),
            'aria-label': 'Filter styles',
          }),
          h('span', { key: 'count', style: { fontSize: 11, color: MUTED } }, visible.length + '/' + rows.length),
        ]),
        error !== ''
          ? h('div', { key: 'err', style: { padding: 16, fontSize: 13, color: MUTED } }, 'Preview routes are unavailable: ' + error)
          : rows.length === 0
            ? h('div', { key: 'loading', style: { padding: 16, fontSize: 13, color: MUTED } }, 'Loading styles…')
            : h('div', {
              key: 'grid',
              style: {
                flex: '1 1 auto',
                minHeight: 0,
                overflow: 'auto',
                padding: 10,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                gap: 10,
                alignContent: 'start',
              },
            }, visible.map(function (entry) {
              return h(GalleryCard, { key: entry.slug, entry: entry, onPick: pick })
            })),
      ])
    }

    /** Filled in `apply`, so panes can move the sidebar without prop drilling. */
    var client = null

    /**
     * Register both tab types, their pane bodies, and the composer commands.
     * @param {object} ctx - client context.
     */
    function apply(ctx) {
      client = ctx

      ctx.effect(function () {
        return ctx.sidebarRightTabs.register({
          id: PREVIEW_ID,
          kind: PREVIEW_KIND,
          title: function () { return 'Style preview' },
          guide: [{
            id: PREVIEW_ID,
            order: 40,
            title: function () { return 'Style preview' },
            description: function () { return 'Preview the UI/UX style the agent last worked on.' },
          }],
        })
      }, 'uiux: preview tab type')

      ctx.effect(function () {
        return ctx.sidebarRightTabs.register({
          id: GALLERY_ID,
          kind: GALLERY_KIND,
          title: function () { return 'Style gallery' },
          guide: [{
            id: GALLERY_ID,
            order: 41,
            title: function () { return 'Style gallery' },
            description: function () { return 'Browse all 79 styles and preview one.' },
          }],
        })
      }, 'uiux: gallery tab type')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PREVIEW_ID }, PreviewPanel)
        })
      }, 'uiux: preview pane body')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: GALLERY_ID }, GalleryPanel)
        })
      }, 'uiux: gallery pane body')

      ctx.effect(function () {
        return ctx.commandUi.register({
          name: 'uiux-preview',
          label: function () { return 'Style preview' },
          description: function () { return 'Open the UI/UX style the agent last worked on.' },
          available: function () { return true },
          ui: {
            kind: 'action',
            run: function () { ctx.sidebarRight.openTab(PREVIEW_KIND) },
          },
        })
      }, 'uiux: preview command')

      ctx.effect(function () {
        return ctx.commandUi.register({
          name: 'uiux-gallery',
          label: function () { return 'Style gallery' },
          description: function () { return 'Browse every UI/UX style as a card.' },
          available: function () { return true },
          ui: {
            kind: 'action',
            run: function () { ctx.sidebarRight.openTab(GALLERY_KIND) },
          },
        })
      }, 'uiux: gallery command')
    }

    exports.apply = apply
    exports.inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'commandUi']
    return module.exports
  },
})
