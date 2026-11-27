// Portuguese (European) messages for the ajv validation errors.
// Short, positive and starting with "Deve" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsPt (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'um texto', number: 'um número', integer: 'um número inteiro', boolean: 'verdadeiro ou falso', array: 'uma lista', object: 'um objeto', null: 'vazio' }
  /** @type {(value: unknown) => unknown} */
  const num = (value) => typeof value === 'number' ? String(value).replace('.', ',') : value
  /** @type {(value: unknown) => string} */
  const show = (value) => {
    if (value === true) return 'sim'
    if (value === false) return 'não'
    if (value === null) return 'vazio'
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
        message = `Informação obrigatória: ${p.missingProperty}`
        break
      case 'minLength':
        message = `Deve ter pelo menos ${count(p.limit, 'carácter', 'caracteres')}`
        break
      case 'maxLength':
        message = `Deve ter no máximo ${count(p.limit, 'carácter', 'caracteres')}`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Deve ser ${p.comparison} ${num(p.limit)}`
        break
      case 'multipleOf':
        message = `Deve ser múltiplo de ${num(p.multipleOf)}`
        break
      case 'format':
        message = `Deve estar no formato ${p.format}`
        break
      case 'pattern':
        message = `Deve estar no formato ${p.pattern}`
        break
      case 'type':
        message = `Deve ser ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' ou ')}`
        break
      case 'enum':
        message = 'Deve ser um dos valores propostos'
        break
      case 'const':
        message = `Deve ser ${show(p.allowedValue)}`
        break
      case 'minItems':
        message = `Deve conter pelo menos ${count(p.limit, 'elemento', 'elementos')}`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Deve conter no máximo ${count(p.limit, 'elemento', 'elementos')}`
        break
      case 'uniqueItems':
        message = 'Deve conter valores distintos'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Deve conter pelo menos ${count(p.minContains ?? 1, 'elemento válido', 'elementos válidos')}`
          : p.maxContains === p.minContains
            ? `Deve conter exatamente ${count(p.maxContains, 'elemento válido', 'elementos válidos')}`
            : `Deve conter entre ${p.minContains ?? 0} e ${count(p.maxContains, 'elemento válido', 'elementos válidos')}`
        break
      case 'minProperties':
        message = `Deve conter pelo menos ${count(p.limit, 'propriedade', 'propriedades')}`
        break
      case 'maxProperties':
        message = `Deve conter no máximo ${count(p.limit, 'propriedade', 'propriedades')}`
        break
      case 'additionalProperties':
        message = `Propriedade não permitida: ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Propriedade não permitida: ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Nome de propriedade inválido: ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Deve ter uma propriedade no formato ${p.missingPattern}`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Escolha um valor'
        break
      case 'anyOf':
        message = 'Deve corresponder a uma das opções'
        break
      case 'if':
        message = 'Valor incompatível'
        break
      case 'not':
      case 'false schema':
        message = 'Valor não permitido'
        break
      default:
        message = 'Valor inválido'
    }
    error.message = message
  }
}
