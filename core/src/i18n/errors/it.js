// Italian messages for the ajv validation errors.
// Short, positive and starting with "Deve" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsIt (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'un testo', number: 'un numero', integer: 'un numero intero', boolean: 'vero o falso', array: 'un elenco', object: 'un oggetto', null: 'vuoto' }
  /** @type {(value: unknown) => unknown} */
  const num = (value) => typeof value === 'number' ? String(value).replace('.', ',') : value
  /** @type {(value: unknown) => string} */
  const show = (value) => {
    if (value === true) return 'sì'
    if (value === false) return 'no'
    if (value === null) return 'vuoto'
    if (typeof value === 'number') return String(num(value))
    return typeof value === 'string' ? value : JSON.stringify(value)
  }
  for (const error of errors) {
    const p = /** @type {Record<string, any>} */(error.params ?? {})
    let message
    switch (error.keyword) {
      case 'required':
      case 'dependentRequired':
      case 'dependencies':
        message = `Informazione obbligatoria: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Deve contenere almeno ${count(p.limit, 'carattere', 'caratteri')}`
        break
      case 'maxLength':
        message = `Deve contenere al massimo ${count(p.limit, 'carattere', 'caratteri')}`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Deve essere ${p.comparison} ${num(p.limit)}`
        break
      case 'multipleOf':
        message = `Deve essere un multiplo di ${num(p.multipleOf)}`
        break
      case 'format':
        message = `Deve essere nel formato ${p.format}`
        break
      case 'pattern':
        message = `Deve essere nel formato ${p.pattern}`
        break
      case 'type':
        message = `Deve essere ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' o ')}`
        break
      case 'enum':
        message = 'Deve essere uno dei valori proposti'
        break
      case 'const':
        message = `Deve essere ${show(p.allowedValue)}`
        break
      case 'minItems':
        message = `Deve contenere almeno ${count(p.limit, 'elemento', 'elementi')}`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Deve contenere al massimo ${count(p.limit, 'elemento', 'elementi')}`
        break
      case 'uniqueItems':
        message = 'Deve contenere valori distinti'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Deve contenere almeno ${count(p.minContains ?? 1, 'elemento valido', 'elementi validi')}`
          : p.maxContains === p.minContains
            ? `Deve contenere esattamente ${count(p.maxContains, 'elemento valido', 'elementi validi')}`
            : `Deve contenere tra ${p.minContains ?? 0} e ${count(p.maxContains, 'elemento valido', 'elementi validi')}`
        break
      case 'minProperties':
        message = `Deve contenere almeno ${count(p.limit, 'proprietà', 'proprietà')}`
        break
      case 'maxProperties':
        message = `Deve contenere al massimo ${count(p.limit, 'proprietà', 'proprietà')}`
        break
      case 'additionalProperties':
        message = `Proprietà non consentita: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Proprietà non consentita: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Nome di proprietà non valido: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Deve avere una proprietà nel formato ${p.missingPattern}`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Scegli un valore'
        break
      case 'anyOf':
        message = 'Deve corrispondere a una delle opzioni'
        break
      case 'if':
        message = 'Valore incompatibile'
        break
      case 'not':
      case 'false schema':
        message = 'Valore non consentito'
        break
      default:
        message = 'Valore non valido'
    }
    error.message = message
  }
}
