import en from './en.js'
import fr from './fr.js'
import nl from './nl.js'
import de from './de.js'
import es from './es.js'
import it from './it.js'
import pt from './pt.js'

/**
 * the validation messages of every locale json-layout writes, the others fallback to en
 * @type {Record<string, (errors: import('ajv').ErrorObject[] | null | undefined) => void>}
 */
export default {
  en,
  fr,
  nl,
  de,
  es,
  it,
  pt
}
