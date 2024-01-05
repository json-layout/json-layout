import ajvModule from 'ajv/dist/2019.js'

const Ajv = ajvModule.default

/**
 * @param {Record<string, import('ajv').SchemaObject>} schemas
 * @param {string} ref
 * @param {ajvModule.default} ajv
 * @returns {[any, string]}
 */
const getJSONRef = (schemas, ref, ajv) => {
  const [schemaId, pointer] = ref.split('#')
  schemas[schemaId] = schemas[schemaId] ?? (ajv.getSchema(schemaId)?.schema)
  if (!schemas[schemaId]) throw new Error(`reference not found ${schemaId}`)
  const pointerParts = pointer.split('/').filter(p => !!p)
  const { value: fragment } = pointerParts.reduce((a, pointerPart) => {
    a.path.push(pointerPart)
    if (!(pointerPart in a.value)) throw new Error(`reference not found ${schemaId}#${a.path.join('/')}`)
    a.value = a.value[pointerPart]
    return a
  }, { path: ['/'], value: schemas[schemaId] })
  return [fragment, schemaId]
}

/**
 * @param {Record<string, import('ajv').SchemaObject>} schemas
 * @param {import('ajv').SchemaObject} schemaFragment
 * @param {string} schemaId
 * @param {ajvModule.default} ajv
 * @param {string} locale
 * @returns {import('ajv').SchemaObject}
 */
const recurse = (schemas, schemaFragment, schemaId, ajv, locale = 'en') => {
  for (const key of Object.keys(schemaFragment)) {
    if (schemaFragment[key] && typeof schemaFragment[key] === 'object') {
      if ('$ref' in schemaFragment[key]) {
        const fullRef = ajv.opts.uriResolver.resolve(schemaId, schemaFragment[key].$ref).replace('~$locale~', locale)
        const fullRefDefaultLocale = ajv.opts.uriResolver.resolve(schemaId, schemaFragment[key].$ref).replace('~$locale~', 'en')
        let refFragment, refSchemaId
        try {
          [refFragment, refSchemaId] = getJSONRef(schemas, fullRef, ajv)
        } catch (err) {
          [refFragment, refSchemaId] = getJSONRef(schemas, fullRefDefaultLocale, ajv)
        }
        if (typeof refFragment === 'object' && !Array.isArray(refFragment)) {
          schemaFragment[key] = { ...refFragment, ...schemaFragment[key] }
          delete schemaFragment[key].$ref
        } else {
          schemaFragment[key] = refFragment
        }
        recurse(schemas, schemaFragment[key], refSchemaId, ajv, locale)
      } else {
        recurse(schemas, schemaFragment[key], schemaId, ajv, locale)
      }
    }
  }
  return schemaFragment
}

/**
 * @param {import('ajv').SchemaObject} schema
 * @param {ajvModule.default} ajv
 * @param {string} locale
 * @returns {import('ajv').SchemaObject}
 */
export function resolveRefs (schema, ajv, locale = 'en') {
  if (!schema.$id) throw new Error('missing schema id')
  return recurse({ [schema.$id]: schema }, schema, schema.$id, ajv ?? new Ajv(), locale)
}
