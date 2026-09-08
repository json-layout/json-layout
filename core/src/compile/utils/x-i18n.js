/**
 * A very simple implementation of some x-i18n-* annotations
 * WARNING: this is a naive implementation that will also apply to const values, examples, etc
 * @param {Record<string, any>} schema
 * @param {string} locale
 * @param {string} [defaultLocale]
 * @param {boolean} [apply] - when false the annotations are stripped without being applied
 */
export const resolveXI18n = (schema, locale, defaultLocale = 'en', apply = true) => {
  if (!schema || typeof schema !== 'object') return
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith('x-i18n-')) {
      // Always removed, even when not applied: these keys belong to this vocabulary, and
      // the option says whether to translate with them, not whether they are legal. Left
      // in place they fail the component schemas' unevaluatedProperties, normalization
      // falls back to the default component, and a one-of-select that stops being a
      // variant selector no longer merges its branch into the parent — the data then
      // never stabilises and updateState throws after 100 iterations.
      if (apply) {
        if (typeof value !== 'object') console.error(`i18n property ${key} should be an object`)
        const realKey = key.replace('x-i18n-', '')
        schema[realKey] = value[locale] ?? value[defaultLocale] ?? schema[realKey]
      }
      delete schema[key]
    } else if (Array.isArray(value)) {
      for (const child of value) {
        resolveXI18n(child, locale, defaultLocale, apply)
      }
    } else {
      resolveXI18n(value, locale, defaultLocale, apply)
    }
  }
}
