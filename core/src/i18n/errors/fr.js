// French messages for the ajv validation errors, replacing ajv-i18n for this locale.
// Short, positive and starting with "Doit" so that they read alike under any field.
// The function must stay self-contained (no import, no outer variable): serialize.js
// inlines its source in the compiled layouts.

/**
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {void}
 */
export default function localizeErrorsFr (errors) {
  if (!errors) return
  /** @type {(n: number, singular: string, plural: string) => string} */
  const count = (n, singular, plural) => `${n} ${n > 1 ? plural : singular}`
  /** @type {Record<string, string>} */
  const typeLabels = { string: 'un texte', number: 'un nombre', integer: 'un nombre entier', boolean: 'vrai ou faux', array: 'une liste', object: 'un objet', null: 'vide' }
  /** @type {(value: unknown) => string} */
  const show = (value) => typeof value === 'string' ? value : JSON.stringify(value)
  for (const error of errors) {
    const p = /** @type {Record<string, any>} */(error.params ?? {})
    let message
    switch (error.keyword) {
      case 'required':
      case 'dependentRequired':
      case 'dependencies':
        message = `Information obligatoire : ${p.missingProperty}`
        break
      case 'minLength':
        message = `Doit faire au moins ${count(p.limit, 'caractère', 'caractères')}`
        break
      case 'maxLength':
        message = `Doit faire au plus ${count(p.limit, 'caractère', 'caractères')}`
        break
      case 'minimum':
      case 'maximum':
      case 'exclusiveMinimum':
      case 'exclusiveMaximum':
      case 'formatMinimum':
      case 'formatMaximum':
      case 'formatExclusiveMinimum':
      case 'formatExclusiveMaximum':
        message = `Doit être ${p.comparison} ${p.limit}`
        break
      case 'multipleOf':
        message = `Doit être un multiple de ${p.multipleOf}`
        break
      case 'format':
        message = `Doit être au format ${p.format}`
        break
      case 'pattern':
        message = `Doit être au format ${p.pattern}`
        break
      case 'type':
        message = `Doit être ${String(p.type).split(',').map(type => typeLabels[type] ?? type).join(' ou ')}`
        break
      case 'enum':
        message = 'Doit être une des valeurs proposées'
        break
      case 'const':
        message = `Doit valoir ${show(p.allowedValue)}`
        break
      case 'minItems':
        message = `Doit contenir au moins ${count(p.limit, 'élément', 'éléments')}`
        break
      case 'maxItems':
      case 'additionalItems':
      case 'items':
      case 'unevaluatedItems':
        message = `Doit contenir au plus ${count(p.limit, 'élément', 'éléments')}`
        break
      case 'uniqueItems':
        message = 'Doit contenir des valeurs distinctes'
        break
      case 'contains':
        message = p.maxContains === undefined
          ? `Doit contenir au moins ${count(p.minContains ?? 1, 'élément valide', 'éléments valides')}`
          : `Doit contenir entre ${p.minContains ?? 0} et ${count(p.maxContains, 'élément valide', 'éléments valides')}`
        break
      case 'minProperties':
        message = `Doit contenir au moins ${count(p.limit, 'propriété', 'propriétés')}`
        break
      case 'maxProperties':
        message = `Doit contenir au plus ${count(p.limit, 'propriété', 'propriétés')}`
        break
      case 'additionalProperties':
        message = `Propriété non autorisée : ${p.additionalProperty}`
        break
      case 'unevaluatedProperties':
        message = `Propriété non autorisée : ${p.unevaluatedProperty}`
        break
      case 'propertyNames':
        message = `Nom de propriété non valide : ${p.propertyName}`
        break
      case 'patternRequired':
        message = `Doit avoir une propriété au format ${p.missingPattern}`
        break
      case 'oneOf':
      case 'discriminator':
        message = 'Choisissez une valeur'
        break
      case 'anyOf':
        message = 'Doit correspondre à une des options'
        break
      case 'if':
        message = 'Valeur incompatible'
        break
      case 'not':
      case 'false schema':
        message = 'Valeur non autorisée'
        break
      default:
        message = 'Valeur non valide'
    }
    error.message = message
  }
}
