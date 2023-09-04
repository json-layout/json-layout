import type Ajv from 'ajv'
import { type SchemaObject } from 'ajv'

const getJSONRef = (schemas: Record<string, SchemaObject>, ref: string, ajv: Ajv): [any, string] => {
  const [schemaId, pointer] = ref.split('#')
  schemas[schemaId] = schemas[schemaId] ?? (ajv.getSchema(schemaId)?.schema) as SchemaObject
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

const recurse = (schemas: Record<string, SchemaObject>, schemaFragment: SchemaObject, schemaId: string, ajv: Ajv, lang: string = 'en'): SchemaObject => {
  for (const key of Object.keys(schemaFragment)) {
    if (typeof schemaFragment[key] === 'object') {
      if ('$ref' in schemaFragment[key]) {
        const fullRef = ajv.opts.uriResolver.resolve(schemaId, schemaFragment[key].$ref).replace('~$locale~', lang)
        const fullRefDefaultLang = ajv.opts.uriResolver.resolve(schemaId, schemaFragment[key].$ref).replace('~$locale~', 'en')
        let refFragment, refSchemaId
        try {
          [refFragment, refSchemaId] = getJSONRef(schemas, fullRef, ajv)
        } catch (err) {
          [refFragment, refSchemaId] = getJSONRef(schemas, fullRefDefaultLang, ajv)
        }
        if (typeof refFragment === 'object' && !Array.isArray(refFragment)) {
          schemaFragment[key] = { ...refFragment, ...schemaFragment[key] }
          delete schemaFragment[key].$ref
        } else {
          schemaFragment[key] = refFragment
        }
        recurse(schemas, schemaFragment[key], refSchemaId, ajv, lang)
      } else {
        recurse(schemas, schemaFragment[key], schemaId, ajv, lang)
      }
    }
  }
  return schemaFragment
}

export function resolveRefs (schema: SchemaObject, ajv: Ajv, lang: string = 'en') {
  if (!schema.$id) throw new Error('missing schema id')
  return recurse({ [schema.$id]: schema }, schema, schema.$id, ajv, lang)
}
