/**
 * A very simple implementation of some x-i18n-* annotations
 * WARNING: this is a naive implementation that will also apply to const values, examples, etc
 * @param {Record<string, any>} schema
 * @param {string} locale
 * @param {string} [defaultLocale]
 */
export const resolveXI18n = (schema, locale, defaultLocale = 'en') => {
  for (const [key, value] of Object.entries(schema)) {
    if (key.startsWith('x-i18n-')) {
      if (typeof value !== 'object') console.error(`i18n property ${key} should be an object`)
      const realKey = key.replace('x-i18n-', '')
      schema[realKey] = value[locale] ?? value[defaultLocale] ?? schema[realKey]
      delete schema[key]
    } else if (Array.isArray(value)) {
      for (const child of value) {
        resolveXI18n(child, locale, defaultLocale)
      }
    } if (typeof value === 'object') {
      resolveXI18n(value, locale, defaultLocale)
    }
  }
}
