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

    var PAGE_ID = 'dsh-uiux/page'
    var PAGE_KIND = 'uiux-page'
    var PREVIEW_ID = 'dsh-uiux/preview'
    var PREVIEW_KIND = 'uiux-preview'
    var GALLERY_ID = 'dsh-uiux/gallery'
    var GALLERY_KIND = 'uiux-gallery'
    var PAGE_URL = '/dsh-uiux/preview/page.html'
    var STYLES_URL = '/dsh-uiux/preview/styles.json'
    var STATE_URL = '/dsh-uiux/preview/state.json'
    var GALLERY_URL = '/dsh-uiux/preview/gallery.json'
    var FILE_URL = '/dsh-uiux/preview/file.html'
    var PAGE_STORAGE = 'dsh-uiux:page-source'
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
     * Fetch JSON, turning an HTTP failure into a readable message instead of the
     * `Unexpected end of JSON input` an empty 404 body produces.
     * @param {string} url - route to read.
     * @returns {Promise<any>} parsed body.
     */
    function getJson(url) {
      return fetch(url, { cache: 'no-store' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status + ' from ' + url)
        return response.text().then(function (text) {
          if (text === '') throw new Error('empty response from ' + url)
          return JSON.parse(text)
        })
      })
    }

    /**
     * The composer facade of one session, or null outside a session.
     * @param {string | undefined} sessionId - session owning the pane.
     * @returns {object | null} SessionInput face.
     */
    function sessionInput(sessionId) {
      if (!sessionId || client === null) return null
      var actx = client.sessions.scope(sessionId)
      if (actx === undefined || actx === null) return null
      try {
        return actx.conversation.input.for(actx)
      } catch {
        return null
      }
    }

    /**
     * The request a gallery pick should send to the agent.
     * @param {object} entry - catalog row.
     * @returns {string} prompt text.
     */
    function requestText(entry) {
      return 'Use the ' + entry.name + ' style (`' + entry.slug + '`) for this UI. '
        + 'Call uiux_spec for its tokens, build to them, and review the result against the checklist.'
    }

    /**
     * Send a style request into the pane's session right now.
     * @param {string | undefined} sessionId - session owning the pane.
     * @param {object} entry - catalog row.
     * @returns {boolean} whether the send was dispatched.
     */
    function sendRequest(sessionId, entry) {
      if (!sessionId || client === null) return false
      var actx = client.sessions.scope(sessionId)
      if (actx === undefined || actx === null) return false
      var input = sessionInput(sessionId)
      actx.conversation.send(requestText(entry)).catch(function (cause) {
        if (input !== null) input.notify('error', 'Could not send the style request: ' + String((cause && cause.message) || cause))
      })
      return true
    }

    /**
     * Put a style request in the composer without destroying a draft the user typed.
     * @param {string | undefined} sessionId - session owning the pane.
     * @param {object} entry - catalog row.
     * @param {boolean} force - overwrite even a hand-written draft.
     * @returns {boolean} whether the composer now holds the request.
     */
    function primeRequest(sessionId, entry, force) {
      var input = sessionInput(sessionId)
      if (input === null) return false
      var draft = ''
      try {
        draft = input.state.getSnapshot().draft
      } catch {
        draft = ''
      }
      var ours = draft === '' || draft.indexOf('Use the ') === 0
      if (!ours && force !== true) {
        input.notify('info', 'The composer already has text — clear it to request the ' + entry.name + ' style.')
        input.focus()
        return false
      }
      input.setDraft(requestText(entry))
      input.notify('info', entry.name + ' style request is in the composer — press Enter to send.')
      input.focus()
      return true
    }

    /**
     * Load the demo page for one style.
     * @param {string} slug - style slug.
     * @param {string} theme - light or dark.
     * @param {string} width - stage width key.
     * @param {number} nonce - cache-busting reload counter.
     * @returns {string} page URL.
     */
    function pageUrl(slug, theme, width, nonce, tweaks) {
      var url = PAGE_URL + '?slug=' + encodeURIComponent(slug) + '&theme=' + theme
        + '&width=' + width + '&v=' + nonce
      var t = tweaks || {}
      if (t.accent) url += '&accent=' + encodeURIComponent(t.accent.replace('#', ''))
      if (t.radius && t.radius !== 1) url += '&radius=' + t.radius
      if (t.space && t.space !== 1) url += '&space=' + t.space
      if (t.type && t.type !== 1) url += '&type=' + t.type
      return url
    }

    /**
     * The preview pane: one style rendered as a page, with controls.
     * @returns {import('react').ReactElement} pane content.
     */
    function PreviewPanel(props) {
      var sessionId = props === undefined ? undefined : props.sessionId
      var stylesState = React.useState([])
      var styles = stylesState[0]
      var setStyles = stylesState[1]
      var slugState = React.useState('')
      var slug = slugState[0]
      var setSlug = slugState[1]
      var otherState = React.useState('')
      var other = otherState[0]
      var setOther = otherState[1]
      var compareState = React.useState(false)
      var compare = compareState[0]
      var setCompare = compareState[1]
      var designState = React.useState(false)
      var design = designState[0]
      var setDesign = designState[1]
      var tweakState = React.useState({ accent: '', radius: 1, space: 1, type: 1 })
      var tweaks = tweakState[0]
      var setTweaks = tweakState[1]
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
      var schemesRef = React.useRef({})
      var accentsRef = React.useRef({})
      var userThemeRef = React.useRef(false)

      React.useEffect(function () {
        followRef.current = follow
      }, [follow])

      React.useEffect(function () {
        var cancelled = false
        getJson(STYLES_URL)
          .then(function (payload) {
            if (cancelled) return
            var rows = payload.styles || []
            var schemes = {}
            var accents = {}
            for (var index = 0; index < rows.length; index += 1) {
              schemes[rows[index].slug] = rows[index].scheme
              accents[rows[index].slug] = rows[index].accent
            }
            schemesRef.current = schemes
            accentsRef.current = accents
            setStyles(rows)
            if (!userThemeRef.current && schemes[rows[0] && rows[0].slug]) setTheme(schemes[rows[0].slug])
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
          getJson(STATE_URL)
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

      React.useEffect(function () {
        if (userThemeRef.current) return
        var native = schemesRef.current[slug]
        if (native === 'light' || native === 'dark') setTheme(native)
      }, [slug])

      var url = slug === '' ? '' : pageUrl(slug, theme, width, nonce, tweaks)
      var otherUrl = other === '' ? '' : pageUrl(other, theme, width, nonce, tweaks)

      var options = styles.map(function (entry) {
        return h('option', { key: entry.slug, value: entry.slug }, entry.name + (entry.depth === 'brief' ? ' ·' : ''))
      })

      function tweak(key, value) {
        setTweaks(function (previous) {
          var next = Object.assign({}, previous)
          next[key] = value
          return next
        })
      }

      var accentValue = tweaks.accent !== '' ? tweaks.accent : (accentsRef.current[slug] || '#000000')

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
          onChange: function (event) {
            setSlug(event.target.value)
            setTweaks({ accent: '', radius: 1, space: 1, type: 1 })
          },
          style: Object.assign(controlStyle(false), { maxWidth: 200, flex: '1 1 140px' }),
          'aria-label': 'Style',
        }, options),
        compare
          ? h('select', {
            key: 'other',
            value: other,
            onChange: function (event) { setOther(event.target.value) },
            style: Object.assign(controlStyle(false), { maxWidth: 200, flex: '1 1 140px' }),
            'aria-label': 'Second style',
          }, [h('option', { key: '', value: '' }, 'Compare with…')].concat(options))
          : null,
        h('div', { key: 'theme', style: { display: 'flex', gap: 4 } }, [
          h('button', {
            key: 'light',
            type: 'button',
            style: controlStyle(theme === 'light'),
            onClick: function () { userThemeRef.current = true; setTheme('light') },
          }, 'Light'),
          h('button', {
            key: 'dark',
            type: 'button',
            style: controlStyle(theme === 'dark'),
            onClick: function () { userThemeRef.current = true; setTheme('dark') },
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
          key: 'design',
          type: 'button',
          style: controlStyle(design),
          onClick: function () { setDesign(!design) },
          title: 'Tweak the accent, rounding, spacing, and type scale',
        }, 'Design'),
        h('button', {
          key: 'compare',
          type: 'button',
          style: controlStyle(compare),
          onClick: function () {
            setCompare(!compare)
            if (!compare && other === '' && styles.length > 1) {
              for (var index = 0; index < styles.length; index += 1) {
                if (styles[index].slug !== slug) { setOther(styles[index].slug); break }
              }
            }
          },
          title: 'Show two styles side by side',
        }, 'Compare'),
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
        h('button', {
          key: 'ask',
          type: 'button',
          style: controlStyle(false),
          disabled: slug === '' || sessionId === undefined,
          title: sessionId === undefined ? 'Open this tab from a chat session to ask the agent' : 'Send this style request to the agent now',
          onClick: function () {
            var entry = null
            for (var index = 0; index < styles.length; index += 1) {
              if (styles[index].slug === slug) entry = styles[index]
            }
            if (entry === null) return
            if (!sendRequest(sessionId, entry)) {
              setError('This pane is not bound to a session; open it from a chat.')
            }
          },
        }, 'Ask agent'),
        url === '' ? null : h('a', {
          key: 'open',
          href: url,
          target: '_blank',
          rel: 'noreferrer',
          style: { fontSize: 12, color: MUTED, marginLeft: 'auto' },
        }, 'Open'),
      ])

      var designBar = !design ? null : h('div', {
        key: 'designbar',
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '6px 8px',
          borderBottom: '1px solid ' + BORDER,
          fontSize: 11,
          color: MUTED,
        },
      }, [
        h('label', { key: 'accent', style: { display: 'flex', alignItems: 'center', gap: 4 } }, [
          'Accent',
          h('input', {
            key: 'color',
            type: 'color',
            value: accentValue,
            onChange: function (event) { tweak('accent', event.target.value) },
            style: { width: 26, height: 20, padding: 0, border: '1px solid ' + BORDER, background: 'transparent' },
          }),
        ]),
        slider('rounding', 'Rounding', 'radius', 0, 2, 0.05),
        slider('spacing', 'Spacing', 'space', 0.8, 1.4, 0.05),
        slider('type', 'Type', 'type', 0.85, 1.2, 0.05),
        h('button', {
          key: 'reset',
          type: 'button',
          style: controlStyle(false),
          onClick: function () { setTweaks({ accent: '', radius: 1, space: 1, type: 1 }) },
        }, 'Reset'),
      ])

      function slider(id, label, key, min, max, step) {
        return h('label', { key: id, style: { display: 'flex', alignItems: 'center', gap: 4 } }, [
          label,
          h('input', {
            key: 'range',
            type: 'range',
            min: min,
            max: max,
            step: step,
            value: tweaks[key],
            onChange: function (event) { tweak(key, Number.parseFloat(event.target.value)) },
            style: { width: 72 },
          }),
          h('span', { key: 'value', style: { minWidth: 26 } }, Math.round(tweaks[key] * 100) + '%'),
        ])
      }

      /**
       * One iframe with a caption.
       * @param {string} frameUrl - page URL.
       * @param {string} label - caption text.
       * @param {string} key - React key.
       * @returns {object} element.
       */
      function stage(frameUrl, label, key) {
        var widthPx = width === 'auto' ? '100%' : (width === 'phone' ? 390 : 768)
        return h('div', {
          key: key,
          style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' },
        }, [
          h('div', { key: 'label', style: { fontSize: 11, color: MUTED, padding: '4px 8px' } }, label),
          h('iframe', {
            key: 'frame',
            src: frameUrl,
            title: label,
            style: {
              width: widthPx,
              maxWidth: '100%',
              flex: '1 1 auto',
              border: width === 'auto' ? 'none' : '1px solid ' + BORDER,
              borderRadius: width === 'auto' ? 0 : 8,
              background: '#fff',
              alignSelf: 'center',
            },
          }),
        ])
      }

      var body = error !== ''
        ? h('div', { style: { padding: 16, fontSize: 13, color: MUTED } }, 'Preview routes are unavailable: ' + error)
        : url === ''
          ? h('div', { style: { padding: 16, fontSize: 13, color: MUTED } }, 'Loading styles…')
          : h('div', {
            style: {
              flex: '1 1 auto',
              minHeight: 0,
              display: 'flex',
              background: 'var(--dsw-alias-bg-secondary, transparent)',
              gap: compare ? 1 : 0,
            },
          }, compare && otherUrl !== ''
            ? [stage(url, slug, 'left'), stage(otherUrl, other, 'right')]
            : [stage(url, '', 'single')])

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' },
      }, [header, designBar, body])
    }

    /**
     * One gallery card: the style's two palettes, its faces, and where it belongs.
     * @param {{ entry: object, onPick: (slug: string) => void }} props - row data and pick handler.
     * @returns {import('react').ReactElement} card.
     */
    function GalleryCard(props) {
      var entry = props.entry
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
        h('img', {
          key: 'thumb',
          src: entry.thumb,
          alt: entry.name + ' preview',
          loading: 'lazy',
          width: 320,
          height: 200,
          style: {
            display: 'block',
            width: '100%',
            height: 'auto',
            borderBottom: '1px solid ' + BORDER,
            background: entry.light.bg,
          },
        }),
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
    function GalleryPanel(props) {
      var sessionId = props === undefined ? undefined : props.sessionId
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
        getJson(GALLERY_URL)
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
        var entry = null
        for (var index = 0; index < rows.length; index += 1) {
          if (rows[index].slug === slug) entry = rows[index]
        }
        if (entry === null) return
        primeRequest(sessionId, entry, false)
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
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 10,
                alignContent: 'start',
              },
            }, visible.map(function (entry) {
              return h(GalleryCard, { key: entry.slug, entry: entry, onPick: pick })
            })),
      ])
    }

    /** Last page source the user loaded, so the tab reopens where they left it. */
    var lastSource = readStoredPage()

    /**
     * Read the remembered page source, ignoring storage being unavailable.
     * @returns {string} last used path or URL.
     */
    function readStoredPage() {
      try {
        return window.localStorage.getItem(PAGE_STORAGE) || ''
      } catch (_) {
        return ''
      }
    }

    /**
     * Remember the page source for next time.
     * @param {string} value - path or URL.
     */
    function storePage(value) {
      try {
        window.localStorage.setItem(PAGE_STORAGE, value)
      } catch (_) { /* private mode: the tab still works, it just forgets */ }
    }

    /**
     * Turn the typed source into something an iframe can load.
     * @param {string} source - absolute path or http(s) URL.
     * @param {number} nonce - bumped by Reload.
     * @returns {string} iframe URL, empty when there is nothing to load.
     */
    function pageSrc(source, nonce) {
      var value = String(source || '').trim()
      if (value === '') return ''
      if (/^https?:\/\//iu.test(value)) {
        var hash = value.indexOf('#')
        var base = hash === -1 ? value : value.slice(0, hash)
        var joiner = base.indexOf('?') === -1 ? '?' : '&'
        return base + joiner + 'uiux=' + nonce + (hash === -1 ? '' : value.slice(hash))
      }
      return FILE_URL + '?path=' + encodeURIComponent(value) + '&uiux=' + nonce
    }

    /**
     * Pane that shows a page the user is building.
     * @returns {object} element tree.
     */
    function PagePanel() {
      var draftState = React.useState(lastSource)
      var draft = draftState[0]
      var setDraft = draftState[1]
      var loadedState = React.useState({ source: lastSource, nonce: 0 })
      var loaded = loadedState[0]
      var setLoaded = loadedState[1]

      function load() {
        var value = draft.trim()
        storePage(value)
        lastSource = value
        setLoaded({ source: value, nonce: 0 })
      }

      function reload() {
        setLoaded(function (previous) { return { source: previous.source, nonce: previous.nonce + 1 } })
      }

      var src = pageSrc(loaded.source, loaded.nonce)
      var remote = /^https?:\/\//iu.test(loaded.source)

      return h('div', {
        style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 6, padding: 8 },
      }, [
        h('div', { key: 'bar', style: { display: 'flex', gap: 4, alignItems: 'center' } }, [
          h('input', {
            key: 'input',
            type: 'text',
            value: draft,
            spellCheck: false,
            placeholder: '/home/you/project/index.html',
            onChange: function (event) { setDraft(event.target.value) },
            onKeyDown: function (event) { if (event.key === 'Enter') load() },
            style: Object.assign(controlStyle(false), {
              flex: '1 1 auto',
              minWidth: 0,
              cursor: 'text',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
            }),
            'aria-label': 'Path or URL to preview',
          }),
          h('button', {
            key: 'load',
            type: 'button',
            onClick: load,
            style: controlStyle(true),
            title: 'Load this path or URL',
          }, 'Load'),
          h('button', {
            key: 'reload',
            type: 'button',
            onClick: reload,
            disabled: src === '',
            style: Object.assign(controlStyle(false), { opacity: src === '' ? 0.5 : 1 }),
            title: 'Reload',
          }, 'Reload'),
        ]),
        h('div', { key: 'hint', style: { fontSize: 11, color: MUTED, lineHeight: '15px' } },
          src === ''
            ? 'Point this at an HTML file you are building, or at a local dev server URL. Relative assets load from the same folder.'
            : (remote ? 'External page: ' : 'File: ') + loaded.source),
        src === ''
          ? h('div', { key: 'empty', style: { flex: '1 1 auto' } })
          : h('iframe', {
            key: 'frame',
            src: src,
            title: 'Your page preview',
            sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals',
            style: { flex: '1 1 auto', width: '100%', minHeight: 240, border: '1px solid ' + BORDER, borderRadius: 8, background: '#fff' },
          }),
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
        return ctx.sidebarRightTabs.register({
          id: PAGE_ID,
          kind: PAGE_KIND,
          title: function () { return 'Your page' },
          guide: [{
            id: PAGE_ID,
            order: 42,
            title: function () { return 'Your page' },
            description: function () { return 'Preview an HTML file or local dev server you are building.' },
          }],
        })
      }, 'uiux: page tab type')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({ name: 'sidebar.right.pane.tab', key: PAGE_ID }, PagePanel)
        })
      }, 'uiux: page pane body')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: PREVIEW_ID,
            inject: function (sessionId) { return { sessionId } },
          }, PreviewPanel)
        })
      }, 'uiux: preview pane body')

      ctx.effect(function () {
        return ctx.slots.inject('sidebar.right.pane.tab', function () {
          return ctx.slots.register({
            name: 'sidebar.right.pane.tab',
            key: GALLERY_ID,
            inject: function (sessionId) { return { sessionId } },
          }, GalleryPanel)
        })
      }, 'uiux: gallery pane body')

      ctx.effect(function () {
        return ctx.commandUi.register({
          name: 'uiux-page',
          label: function () { return 'Your page' },
          description: function () { return 'Preview an HTML file or local dev server you are building.' },
          available: function () { return true },
          ui: {
            kind: 'action',
            run: function () { ctx.sidebarRight.openTab(PAGE_KIND) },
          },
        })
      }, 'uiux: page command')

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
    exports.inject = ['slots', 'sidebarRightTabs', 'sidebarRight', 'commandUi', 'sessions']
    return module.exports
  },
})
