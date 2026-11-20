import en from './en.js'
import fr from './fr.js'

/**
 * the locales whose validation messages are written here, the others still come from ajv-i18n
 * @type {Record<string, (errors: import('ajv').ErrorObject[] | null | undefined) => void>}
 */
export default {
  en,
  fr
}
