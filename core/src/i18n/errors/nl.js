// Dutch messages for the ajv validation errors, replacing ajv-i18n for this locale.
// Short, positive and starting with "Moet" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsNl (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'een tekst', number: 'een getal', integer: 'een geheel getal', boolean: 'waar of onwaar', array: 'een lijst', object: 'een object', null: 'leeg' }
  /** @type {(value: unknown) => unknown} */
  const num = (value) => typeof value === 'number' ? String(value).replace('.', ',') : value
  /** @type {(value: unknown) => string} */
  const show = (value) => {
    if (value === true) return 'ja'
    if (value === false) return 'nee'
    if (value === null) return 'leeg'
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
        message = `Verplichte informatie: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Moet minimaal ${count(p.limit, 'teken', 'tekens')} lang zijn`
        break
      case 'maxLength':
        message = `Moet maximaal ${count(p.limit, 'teken', 'tekens')} lang zijn`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Moet ${p.comparison} ${num(p.limit)} zijn`
        break
      case 'multipleOf':
        message = `Moet een veelvoud van ${num(p.multipleOf)} zijn`
        break
      case 'format':
        message = `Moet het formaat ${p.format} hebben`
        break
      case 'pattern':
        message = `Moet overeenkomen met het formaat ${p.pattern}`
        break
      case 'type':
        message = `Moet ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' of ')} zijn`
        break
      case 'enum':
        message = 'Moet een van de voorgestelde waarden zijn'
        break
      case 'const':
        message = `Moet ${show(p.allowedValue)} zijn`
        break
      case 'minItems':
        message = `Moet minimaal ${count(p.limit, 'element', 'elementen')} bevatten`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Moet maximaal ${count(p.limit, 'element', 'elementen')} bevatten`
        break
      case 'uniqueItems':
        message = 'Moet unieke waarden bevatten'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Moet minimaal ${count(p.minContains ?? 1, 'geldig element', 'geldige elementen')} bevatten`
          : p.maxContains === p.minContains
            ? `Moet precies ${count(p.maxContains, 'geldig element', 'geldige elementen')} bevatten`
            : `Moet tussen ${p.minContains ?? 0} en ${count(p.maxContains, 'geldig element', 'geldige elementen')} bevatten`
        break
      case 'minProperties':
        message = `Moet minimaal ${count(p.limit, 'eigenschap', 'eigenschappen')} bevatten`
        break
      case 'maxProperties':
        message = `Moet maximaal ${count(p.limit, 'eigenschap', 'eigenschappen')} bevatten`
        break
      case 'additionalProperties':
        message = `Eigenschap niet toegestaan: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Eigenschap niet toegestaan: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Ongeldige eigenschapsnaam: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Moet een eigenschap met het formaat ${p.missingPattern} bevatten`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Maak een keuze'
        break
      case 'anyOf':
        message = 'Moet overeenkomen met een van de opties'
        break
      case 'if':
        message = 'Onverenigbare waarde'
        break
      case 'not':
      case 'false schema':
        message = 'Waarde niet toegestaan'
        break
      default:
        message = 'Ongeldige waarde'
    }
    error.message = message
  }
}
