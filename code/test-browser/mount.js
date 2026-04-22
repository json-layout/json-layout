/**
 * Minimal browser mount for the @json-layout/code Playwright harness.
 * Exposes window.__mount(schema, data) plus __layout, __view, __dispatch
 * so specs can drive the editor without Nuxt/Vuetify in the way.
 *
 * Intentionally stripped of dev-ergonomics extensions (theme, history,
 * defaultKeymap, lintGutter): the autocomplete popup has its own keymap,
 * text input goes through the contenteditable, and cursor positioning goes
 * through __dispatch. Less third-party surface = less cross-version flake.
 */

import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { startCompletion, completionStatus, currentCompletions } from '@codemirror/autocomplete'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonLayoutExtensions, computeCompletions } from '@json-layout/code'

const host = /** @type {HTMLElement} */(document.getElementById('app'))

/**
 * Mount the editor against a schema/data pair. Mirrors the boot sequence in
 * doc/pages/examples/[id].vue so bugs the doc app would see are reproducible
 * here too. Resolves once the view has finished its first measurement.
 * @param {object} schema
 * @param {unknown} data
 * @param {object} [layoutOptions] — merged into StatefulLayout options; used
 *   by the get-items fixture to provide `context.countries` for the getItems
 *   expression.
 */
async function mount (schema, data, layoutOptions) {
  if (window.__view) {
    window.__view.destroy()
    host.innerHTML = ''
  }

  const compiledLayout = await compile(schema)
  const statefulLayout = new StatefulLayout(
    compiledLayout,
    compiledLayout.skeletonTrees[compiledLayout.mainTree],
    { debounceInputMs: 0, initialValidation: 'always', ...layoutOptions },
    data
  )
  const initialText = JSON.stringify(data, null, 2)

  const view = new EditorView({
    parent: host,
    state: EditorState.create({
      doc: initialText,
      extensions: [
        EditorView.updateListener.of((update) => {
          if (update.docChanged) window.__lastText = update.state.doc.toString()
        }),
        ...jsonLayoutExtensions(compiledLayout, { statefulLayout })
      ]
    })
  })

  window.__compiled = compiledLayout
  window.__layout = statefulLayout
  window.__view = view
  window.__lastText = initialText
  window.__dispatch = (spec) => view.dispatch(spec)
  window.__startCompletion = () => {
    view.focus()
    return startCompletion(view)
  }
  window.__completionStatus = () => completionStatus(view.state)
  window.__currentCompletions = () => currentCompletions(view.state).map((o) => ({ label: o.label, detail: o.detail }))
  window.__computeCompletions = (pos, explicit = true) => {
    const result = computeCompletions(view.state, pos ?? view.state.selection.main.head, explicit)
    if (!result) return null
    return { from: result.from, to: result.to, options: result.options.map((o) => ({ label: o.label, type: o.type })) }
  }

  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
}

window.__mount = mount
window.__ready = true
