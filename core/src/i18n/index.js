import en from './en.js'
import fr from './fr.js'
import nl from './nl.js'
import de from './de.js'
import es from './es.js'
import it from './it.js'
import pt from './pt.js'

/**
 * the locale json-layout writes its own messages in: the asked one, else the language of the
 * schema's texts, else en
 * @param {string} locale
 * @param {string} defaultLocale
 * @returns {string}
 */
export const messagesLocale = (locale, defaultLocale) => [locale, defaultLocale].find(l => Object.hasOwn(i18n, l)) ?? 'en'

/** @type {Record<string, import('./types.js').LocaleMessages>} */
const i18n = {
  en,
  fr,
  nl,
  de,
  es,
  it,
  pt
}

export default i18n
