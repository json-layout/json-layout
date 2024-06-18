import ajvModule from 'ajv/dist/2019.js'


/**
 * @param {Record<string, import('ajv').SchemaObject>} schemas
 * @param {ajvModule.default} ajv
 * @returns {(schemaId: string, ref: string) => [any, string, string]}
 */
const prepareGetJSONRef = (schemas, ajv) => 
{
  return (sourceSchemaId, ref) => {
    const fullRef = ajv.opts.uriResolver.resolve(sourceSchemaId, ref)
    const [schemaId, pointer] = fullRef.split('#')
    schemas[schemaId] = schemas[schemaId] ?? (ajv.getSchema(schemaId)?.schema)
    if (!schemas[schemaId]) throw new Error(`reference not found ${schemaId}`)
    const pointerParts = pointer.split('/').filter(p => !!p)
    const { value: fragment } = pointerParts.reduce((a, pointerPart) => {
      a.path.push(pointerPart)
      if (!(pointerPart in a.value)) throw new Error(`reference not found ${schemaId}#${a.path.join('/')}`)
      a.value = a.value[pointerPart]
      return a
    }, { path: /** @type {string[]} */([]), value: schemas[schemaId] })
    return [fragment, schemaId, fullRef]
  }
}

/**
 * mutates a schema by replacing ~$locale~ in all refs
 * @param {import('ajv').SchemaObject} schema
 * @param {ajvModule.default} ajv
 * @param {string} locale
 * @returns {(schemaId: string, ref: string) => [any, string, string]}
 */
export function resolveLocaleRefs (schema, ajv, locale = 'en') {
  if (!schema.$id) throw new Error('missing schema id')
  const getJSONRef = prepareGetJSONRef({ [schema.$id]: schema }, ajv)
  /** @type {any[]} */
  const recursed = []
  recurseResolveLocale(schema, schema.$id, getJSONRef, locale, recursed)
  return getJSONRef
}

/**
 * @param {import('ajv').SchemaObject} schemaFragment
 * @param {string} schemaId
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 * @param {string} locale
 * @param {any[]} recursed
 */

const recurseResolveLocale = (schemaFragment, schemaId, getJSONRef, locale, recursed) => {
  if (recursed.includes(schemaFragment)) return
  recursed.push(schemaFragment)
  for (const key of Object.keys(schemaFragment)) {
    if (schemaFragment[key] && typeof schemaFragment[key] === 'object') {
      if ('$ref' in schemaFragment[key]) {
        const ref = schemaFragment[key].$ref.replace('~$locale~', locale)
        const refDefaultLocale = schemaFragment[key].$ref.replace('~$locale~', 'en')
        let refFragment, refSchemaId
        try {
          [refFragment, refSchemaId] = getJSONRef(schemaId, ref)
          schemaFragment[key].$ref = ref
        } catch (err) {
          [refFragment, refSchemaId] = getJSONRef(schemaId, refDefaultLocale)
          schemaFragment[key].$ref = refDefaultLocale
        }
        if (typeof refFragment === 'string') {
          schemaFragment[key] = refFragment
        } else {
          recurseResolveLocale(refFragment, refSchemaId, getJSONRef, locale, recursed)
        }
      } else {
        recurseResolveLocale(schemaFragment[key], schemaId, getJSONRef, locale, recursed)
      }
    }
  }
}
