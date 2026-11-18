/**
 * dsh-uiux — client half: a right-sidebar tab that previews a catalog style.
 *
 * Format: the loader's lazy CommonJS wrapper, same as DSH's own client plugins, so
 * there is no build step. Everything the tab shows comes from the host routes in
 * `src/routes.js`; the tab itself only fetches JSON and points an iframe at
 * `/dsh-uiux/preview/page.html`.
 *
 * The tab follows the agent: whenever `uiux_spec` runs, the host bumps a revision,
 * and the panel adopts the first slug of that spec set unless the user pinned a
 * style by hand.
 */
window.__ModuleLoader__.load({
  id: 'dsh-uiux',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var h = React.createElement

    var TAB_ID = 'dsh-uiux/preview'
    var KIND = 'uiux-preview'
    var PAGE_URL = '/dsh-uiux/preview/page.html'
    var STYLES_URL = '/dsh-uiux/preview/styles.json'
    var STATE_URL = '/dsh-uiux/preview/state.json'
    var POLL_MS = 2500
    var WIDTHS = [
      { value: 'auto', label: 'Full' },
      { value: 'tablet', label: '768' },
      { value: 'phone', label: '390' },
    ]

    var BORDER = 'var(--dsw-alias-border-secondary, rgba(127, 127, 127, 0.28))'
    var SURFACE = 'var(--dsw-alias-bg-primary, transparent)'
    var MUTED = 'var(--dsw-alias-text-tertiary, rgba(127, 127, 127, 0.9))'

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
     * The preview pane body. Reads no tab props: everything it needs is fetched.
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
     * Register the tab type and its pane body.
     * @param {object} ctx - client context.
     */
    function apply(ctx) {
      ctx.effect(function () {
        return ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: KIND,
          title: function () { return 'Style preview' },
          guide: [{
            id: TAB_ID,
            order: 40,
            title: function () { return 'Style preview' },
            description: function () { return 'Preview the UI/UX style the agent last worked on.' },
          }],
        })
      }, 'uiux: preview tab type')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, PreviewPanel)
        })
      }, 'uiux: preview pane body')
    }

    exports.apply = apply
    exports.inject = ['slots', 'sidebarRightTabs']
    return module.exports
  },
})
