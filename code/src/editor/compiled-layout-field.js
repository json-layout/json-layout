/**
 * @file CM6 StateField + StateEffect carrying the CompiledLayout on an
 * EditorState. Read via `state.field(compiledLayoutField)`; update via a
 * transaction with `setCompiledLayoutEffect.of(compiledLayout)`.
 */

import { StateEffect, StateField } from '@codemirror/state'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */

/** @type {import('@codemirror/state').StateEffectType<CompiledLayout>} */
export const setCompiledLayoutEffect = StateEffect.define()

/** @type {import('@codemirror/state').StateField<CompiledLayout | null>} */
export const compiledLayoutField = StateField.define({
  create () { return null },
  /**
   * @param {CompiledLayout | null} value
   * @param {import('@codemirror/state').Transaction} tr
   * @returns {CompiledLayout | null}
   */
  update: /** @type {any} */ (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setCompiledLayoutEffect)) return effect.value
    }
    return value
  }
})
