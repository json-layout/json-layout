/**
 * @file CM6 ViewPlugin that debounces doc changes and runs the committed
 * sync (parse → update StatefulLayout → dispatch diagnostics). 250ms idle
 * delay, per spec. Commit-point heuristics (closing brace/quote/end-of-line)
 * are deferred to a later plan.
 */

import { ViewPlugin } from '@codemirror/view'
import { runCommittedSync } from './sync.js'

const DEBOUNCE_MS = 250

export const statefulLayoutSyncPlugin = ViewPlugin.fromClass(class {
  /**
   * @param {import('@codemirror/view').EditorView} view
   */
  constructor (view) {
    this.view = view
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null
    this.schedule()
  }

  schedule () {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      runCommittedSync(this.view.state, (tr) => this.view.dispatch(tr))
    }, DEBOUNCE_MS)
  }

  /**
   * @param {import('@codemirror/view').ViewUpdate} update
   */
  update (update) {
    if (update.docChanged) this.schedule()
  }

  destroy () {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
})
