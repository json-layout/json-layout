import ajvModule from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import { marked } from 'marked'
import { produce } from 'immer'
import i18n from '../i18n/index.js'
import { standardComponents } from '@json-layout/vocabulary'
import { shallowEqualArray } from '../state/utils/immutable.js'

/**
 * @typedef {import('./types.js').CompileOptions} CompileOptions
 * @typedef {import('./types.js').PartialCompileOptions} PartialCompileOptions
 */

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

/**
 * @param {PartialCompileOptions} partialOptions
 * @returns {CompileOptions}
 */
export const fillOptions = (partialOptions) => {
  let ajv = partialOptions.ajv
  if (!ajv) {
    /** @type {import('ajv').Options} */
    const ajvOpts = { allErrors: true, strict: false, verbose: true }
    if (partialOptions.ajvOptions) Object.assign(ajvOpts, partialOptions.ajvOptions)
    if (partialOptions.code) ajvOpts.code = { source: true, esm: true, lines: true }
    const newAjv = new Ajv(ajvOpts)
    addFormats.default(newAjv)
    ajvErrors.default(newAjv)
    ajv = newAjv
  }

  // prevent some unknown keyword warnings, can break if ajv is reused and keywords ware already added
  try { ajv.addKeyword('layout') } catch (e) {}
  try { ajv.addKeyword('__pointer') } catch (e) {}

  let markdown = partialOptions.markdown
  if (!markdown) {
    const render = (/** @type {string} */text) => marked.parse(text, partialOptions.markedOptions)
    markdown = /** @type {(text: string) => string} */(render)
  }

  const defaultLocale = partialOptions.defaultLocale || 'en'
  const locale = partialOptions.locale || defaultLocale
  const messages = { ...i18n[locale] || i18n[defaultLocale] }
  if (partialOptions.messages) Object.assign(messages, partialOptions.messages)

  const components = standardComponents.reduce((acc, component) => {
    acc[component.name] = component
    return acc
  }, /** @type {Record<string, import('@json-layout/vocabulary').ComponentInfo>} */({}))

  if (partialOptions.components) {
    for (const componentName of Object.keys(partialOptions.components)) {
      components[componentName] = { ...partialOptions.components[componentName], name: componentName }
    }
    Object.assign(components, partialOptions.components)
  }

  return {
    ajv,
    code: false,
    markdown,
    useDescription: ['help', 'subtitle'],
    useDefault: 'data',
    useName: false,
    useExamples: 'items',
    useDeprecated: false,
    useTitle: 'label',
    ...partialOptions,
    locale,
    defaultLocale,
    messages,
    components,
    xI18n: !!partialOptions.xI18n
  }
}

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: PartialCompileOptions, newOptions: PartialCompileOptions) => PartialCompileOptions} */
export const produceCompileOptions = produce((draft, newOptions) => {
  for (const key of ['ajv', 'ajvOptions', 'code', 'markdown', 'markedOptions', 'xI18n', 'locale', 'defaultLocale', 'messages', 'optionsKeys', 'components', 'useDescription', 'useDefault', 'useName', 'useExamples', 'useDeprecated', 'useTitle']) {
    // @ts-ignore
    if (key in newOptions) {
      // components is problematic because it is an object with nested objects
      // simply compare their keys instead of the whole object
      if (key === 'components' && shallowEqualArray(Object.keys(draft.components ?? []), Object.keys(newOptions.components ?? []))) {
        continue
      }
      // @ts-ignore
      draft[key] = newOptions[key]
    } else {
      // @ts-ignore
      delete draft[key]
    }
  }
})
