// German messages for the ajv validation errors, replacing ajv-i18n for this locale.
// Short, positive and starting with "Muss" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsDe (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'ein Text', number: 'eine Zahl', integer: 'eine ganze Zahl', boolean: 'wahr oder falsch', array: 'eine Liste', object: 'ein Objekt', null: 'leer' }
  /** @type {(value: unknown) => unknown} */
  const num = (value) => typeof value === 'number' ? String(value).replace('.', ',') : value
  /** @type {(value: unknown) => string} */
  const show = (value) => {
    if (value === true) return 'ja'
    if (value === false) return 'nein'
    if (value === null) return 'leer'
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
        message = `Pflichtangabe: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Muss mindestens ${count(p.limit, 'Zeichen', 'Zeichen')} lang sein`
        break
      case 'maxLength':
        message = `Muss höchstens ${count(p.limit, 'Zeichen', 'Zeichen')} lang sein`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Muss ${p.comparison} ${num(p.limit)} sein`
        break
      case 'multipleOf':
        message = `Muss ein Vielfaches von ${num(p.multipleOf)} sein`
        break
      case 'format':
        message = `Muss im Format ${p.format} sein`
        break
      case 'pattern':
        message = `Muss dem Format ${p.pattern} entsprechen`
        break
      case 'type':
        message = `Muss ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' oder ')} sein`
        break
      case 'enum':
        message = 'Muss einer der vorgeschlagenen Werte sein'
        break
      case 'const':
        message = `Muss ${show(p.allowedValue)} sein`
        break
      case 'minItems':
        message = `Muss mindestens ${count(p.limit, 'Element', 'Elemente')} enthalten`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Muss höchstens ${count(p.limit, 'Element', 'Elemente')} enthalten`
        break
      case 'uniqueItems':
        message = 'Muss unterschiedliche Werte enthalten'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Muss mindestens ${count(p.minContains ?? 1, 'gültiges Element', 'gültige Elemente')} enthalten`
          : p.maxContains === p.minContains
            ? `Muss genau ${count(p.maxContains, 'gültiges Element', 'gültige Elemente')} enthalten`
            : `Muss zwischen ${p.minContains ?? 0} und ${count(p.maxContains, 'gültiges Element', 'gültige Elemente')} enthalten`
        break
      case 'minProperties':
        message = `Muss mindestens ${count(p.limit, 'Eigenschaft', 'Eigenschaften')} enthalten`
        break
      case 'maxProperties':
        message = `Muss höchstens ${count(p.limit, 'Eigenschaft', 'Eigenschaften')} enthalten`
        break
      case 'additionalProperties':
        message = `Eigenschaft nicht erlaubt: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Eigenschaft nicht erlaubt: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Ungültiger Eigenschaftsname: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Muss eine Eigenschaft im Format ${p.missingPattern} enthalten`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Bitte eine Option wählen'
        break
      case 'anyOf':
        message = 'Muss einer der Optionen entsprechen'
        break
      case 'if':
        message = 'Unvereinbarer Wert'
        break
      case 'not':
      case 'false schema':
        message = 'Wert nicht erlaubt'
        break
      default:
        message = 'Ungültiger Wert'
    }
    error.message = message
  }
}
