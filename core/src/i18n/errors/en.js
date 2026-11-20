// English messages for the ajv validation errors, replacing ajv-i18n for this locale.
// Short, positive and starting with "Must" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsEn (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'a text', number: 'a number', integer: 'an integer', boolean: 'true or false', array: 'a list', object: 'an object', null: 'empty' }
  /** @type {(value: unknown) => string} */
  const show = (value) => typeof value === 'string' ? value : JSON.stringify(value)
  for (const error of errors) {
    const p = /** @type {Record<string, any>} */(error.params ?? {})
    let message
    switch (error.keyword) {
      case 'required':
      case 'dependentRequired':
      case 'dependencies':
        message = `Required information: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Must be at least ${count(p.limit, 'character', 'characters')}`
        break
      case 'maxLength':
        message = `Must be at most ${count(p.limit, 'character', 'characters')}`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Must be ${p.comparison} ${p.limit}`
        break
      case 'multipleOf':
        message = `Must be a multiple of ${p.multipleOf}`
        break
      case 'format':
        message = `Must be in ${p.format} format`
        break
      case 'pattern':
        message = `Must be in format ${p.pattern}`
        break
      case 'type':
        message = `Must be ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' or ')}`
        break
      case 'enum':
        message = 'Must be one of the listed values'
        break
      case 'const':
        message = `Must be ${show(p.allowedValue)}`
        break
      case 'minItems':
        message = `Must have at least ${count(p.limit, 'item', 'items')}`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Must have at most ${count(p.limit, 'item', 'items')}`
        break
      case 'uniqueItems':
        message = 'Must have distinct values'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Must have at least ${count(p.minContains ?? 1, 'valid item', 'valid items')}`
          : `Must have between ${p.minContains ?? 0} and ${count(p.maxContains, 'valid item', 'valid items')}`
        break
      case 'minProperties':
        message = `Must have at least ${count(p.limit, 'property', 'properties')}`
        break
      case 'maxProperties':
        message = `Must have at most ${count(p.limit, 'property', 'properties')}`
        break
      case 'additionalProperties':
        message = `Property not allowed: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Property not allowed: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Invalid property name: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Must have a property in format ${p.missingPattern}`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Choose one'
        break
      case 'anyOf':
        message = 'Must match one of the options'
        break
      case 'if':
        message = 'Incompatible value'
        break
      case 'not':
      case 'false schema':
        message = 'Value not allowed'
        break
      default:
        message = 'Invalid value'
    }
    error.message = message
  }
}
