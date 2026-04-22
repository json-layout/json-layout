/**
 * @file CM6 StateField + StateEffect carrying a host-owned StatefulLayout on
 * an EditorState. The field holds a reference; `.data` mutations happen
 * out-of-band in the sync plugin and do not change field identity. Read via
 * `state.field(statefulLayoutField)`; replace via a transaction with
 * `setStatefulLayoutEffect.of(statefulLayout)`.
 */

import { StateEffect, StateField } from '@codemirror/state'

/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */

/** @type {import('@codemirror/state').StateEffectType<StatefulLayout>} */
export const setStatefulLayoutEffect = StateEffect.define()

/** @type {import('@codemirror/state').StateField<StatefulLayout | null>} */
export const statefulLayoutField = StateField.define({
  create () { return null },
  /**
   * @param {StatefulLayout | null} value
   * @param {import('@codemirror/state').Transaction} tr
   * @returns {StatefulLayout | null}
   */
  update: /** @type {any} */ (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setStatefulLayoutEffect)) return effect.value
    }
    return value
  }
})
