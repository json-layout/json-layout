import { clone } from '@json-layout/vocabulary'

/**
 * @param {Record<string, import('ajv').SchemaObject>} schemas
 * @param {import('ajv/dist/2019.js').default} ajv
 * @returns {(schemaId: string, ref: string) => [any, string, string]}
 */
const prepareGetJSONRef = (schemas, ajv) => {
  return (sourceSchemaId, ref) => {
    const fullRef = ajv.opts.uriResolver.resolve(sourceSchemaId, ref)
    const [schemaId, pointer] = fullRef.split('#')
    schemas[schemaId] = schemas[schemaId] ?? (ajv.getSchema(schemaId)?.schema)
    if (!schemas[schemaId]) throw new Error(`reference not found ${schemaId}`)
    if (!pointer) return [schemas[schemaId], schemaId, fullRef]
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
 * @param {import('ajv/dist/2019.js').default} ajv
 * @param {string} [locale]
 * @param {string} [defaultLocale]
 * @returns {(schemaId: string, ref: string) => [any, string, string]}
 */
export function resolveLocaleRefs (schema, ajv, locale = 'en', defaultLocale = 'en') {
  if (!schema.$id) throw new Error('missing schema id')
  const getJSONRef = prepareGetJSONRef({ [schema.$id]: schema }, ajv)
  /** @type {any[]} */
  const recursed = []
  recurseResolveLocale(schema, schema.$id, getJSONRef, locale, defaultLocale, recursed)
  return getJSONRef
}

/**
 * @param {import('ajv').SchemaObject} schemaFragment
 * @param {string} schemaId
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 * @param {string} locale
 * @param {string} defaultLocale
 * @param {any[]} recursed
 */

const recurseResolveLocale = (schemaFragment, schemaId, getJSONRef, locale, defaultLocale, recursed) => {
  if (recursed.includes(schemaFragment)) return
  recursed.push(schemaFragment)
  for (const key of Object.keys(schemaFragment)) {
    if (schemaFragment[key] && typeof schemaFragment[key] === 'object') {
      if ('$ref' in schemaFragment[key]) {
        const ref = schemaFragment[key].$ref.replace('~$locale~', locale)
        const refDefaultLocale = schemaFragment[key].$ref.replace('~$locale~', defaultLocale)
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
          recurseResolveLocale(refFragment, refSchemaId, getJSONRef, locale, defaultLocale, recursed)
        }
      } else {
        recurseResolveLocale(schemaFragment[key], schemaId, getJSONRef, locale, defaultLocale, recursed)
      }
    }
  }
}

/**
 * partially resolve a schema but not recursively, used for layout normalization
 * @param {import('ajv').SchemaObject} schema
 * @param {string} schemaId
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 */
export function partialResolveRefs (schema, schemaId, getJSONRef) {
  let clonedSchema = null
  if (schema.items && schema.items.$ref) {
    const [refFragment] = getJSONRef(schemaId, schema.items.$ref)
    clonedSchema = clonedSchema ?? clone(schema)
    clonedSchema.items = { ...refFragment, ...schema.items }
  }
  if (schema.properties) {
    for (const key in schema.properties) {
      if (schema.properties[key].$ref) {
        const [refFragment] = getJSONRef(schemaId, schema.properties[key].$ref)
        clonedSchema = clonedSchema ?? clone(schema)
        clonedSchema.properties[key] = { ...refFragment, ...schema.properties[key] }
      }
    }
  }
  if (schema.oneOf) {
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (schema.oneOf[i].$ref) {
        const [refFragment] = getJSONRef(schemaId, schema.oneOf[i].$ref)
        clonedSchema = clonedSchema ?? clone(schema)
        clonedSchema.oneOf[i] = { ...refFragment, ...schema.oneOf[i] }
      }
    }
  }
  if (schema.anyOf) {
    for (let i = 0; i < schema.anyOf.length; i++) {
      if (schema.anyOf[i].$ref) {
        const [refFragment] = getJSONRef(schemaId, schema.anyOf[i].$ref)
        clonedSchema = clonedSchema ?? clone(schema)
        clonedSchema.anyOf[i] = { ...refFragment, ...schema.anyOf[i] }
      }
    }
  }
  if (schema.allOf) {
    for (let i = 0; i < schema.allOf.length; i++) {
      if (schema.allOf[i].$ref) {
        const [refFragment] = getJSONRef(schemaId, schema.allOf[i].$ref)
        clonedSchema = clonedSchema ?? clone(schema)
        clonedSchema.allOf[i] = { ...refFragment, ...schema.allOf[i] }
      }
    }
  }

  return clonedSchema ?? schema
}
