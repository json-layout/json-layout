// Spanish messages for the ajv validation errors, replacing ajv-i18n for this locale.
// Short, positive and starting with "Debe" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsEs (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'un texto', number: 'un número', integer: 'un número entero', boolean: 'verdadero o falso', array: 'una lista', object: 'un objeto', null: 'vacío' }
  /** @type {(value: unknown) => unknown} */
  const num = (value) => typeof value === 'number' ? String(value).replace('.', ',') : value
  /** @type {(value: unknown) => string} */
  const show = (value) => {
    if (value === true) return 'sí'
    if (value === false) return 'no'
    if (value === null) return 'vacío'
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
        message = `Información obligatoria: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Debe tener al menos ${count(p.limit, 'carácter', 'caracteres')}`
        break
      case 'maxLength':
        message = `Debe tener como máximo ${count(p.limit, 'carácter', 'caracteres')}`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Debe ser ${p.comparison} ${num(p.limit)}`
        break
      case 'multipleOf':
        message = `Debe ser múltiplo de ${num(p.multipleOf)}`
        break
      case 'format':
        message = `Debe tener el formato ${p.format}`
        break
      case 'pattern':
        message = `Debe tener el formato ${p.pattern}`
        break
      case 'type':
        message = `Debe ser ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' o ')}`
        break
      case 'enum':
        message = 'Debe ser uno de los valores propuestos'
        break
      case 'const':
        message = `Debe ser ${show(p.allowedValue)}`
        break
      case 'minItems':
        message = `Debe contener al menos ${count(p.limit, 'elemento', 'elementos')}`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Debe contener como máximo ${count(p.limit, 'elemento', 'elementos')}`
        break
      case 'uniqueItems':
        message = 'Debe contener valores distintos'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Debe contener al menos ${count(p.minContains ?? 1, 'elemento válido', 'elementos válidos')}`
          : p.maxContains === p.minContains
            ? `Debe contener exactamente ${count(p.maxContains, 'elemento válido', 'elementos válidos')}`
            : `Debe contener entre ${p.minContains ?? 0} y ${count(p.maxContains, 'elemento válido', 'elementos válidos')}`
        break
      case 'minProperties':
        message = `Debe contener al menos ${count(p.limit, 'propiedad', 'propiedades')}`
        break
      case 'maxProperties':
        message = `Debe contener como máximo ${count(p.limit, 'propiedad', 'propiedades')}`
        break
      case 'additionalProperties':
        message = `Propiedad no permitida: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Propiedad no permitida: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Nombre de propiedad no válido: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Debe tener una propiedad con el formato ${p.missingPattern}`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Elige un valor'
        break
      case 'anyOf':
        message = 'Debe coincidir con una de las opciones'
        break
      case 'if':
        message = 'Valor incompatible'
        break
      case 'not':
      case 'false schema':
        message = 'Valor no permitido'
        break
      default:
        message = 'Valor no válido'
    }
    error.message = message
  }
}
