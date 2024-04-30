import { compile as compileTs } from 'json-schema-to-typescript'
import normalizedLayoutSchema from '../normalized-layout/schema.js'

const localResolver = {
  order: 1,
  /**
   * @param {{ url: string }} file
   * @returns {boolean}
   */
  canRead (file) {
    return file.url === normalizedLayoutSchema.$id
  },
  /**
   * @param {{ url: string }} file
   * @param {(err: any, doc?: any) => void} callback
   */
  async read (/** @type {{ url: string }} */file, callback) {
    const clonedSchema = JSON.parse(JSON.stringify(normalizedLayoutSchema))
    delete clonedSchema.$id
    callback(null, clonedSchema)
  }
}

const compileTsOptions = {
  bannerComment: '',
  declareExternallyReferenced: false,
  $refOptions: { resolve: { local: localResolver } }
}

/**
 * @param {string} from
 * @returns {string}
 */
export function getComponentTypesCodeImport (from) {
  return `import type {
  BaseCompObject,
  CompositeCompObject,
  SimpleCompObject,
  FocusableCompObject,
  ItemsBasedCompObject,
  Expression,
  Children,
  GetItems,
  SelectItems
} from '${from}'\n`
}

/**
 * @param {any} schema
 * @param {string} key
 * @param {boolean} standalone
 * @returns {Promise<string>}
 */
export async function getComponentTypesCode (schema, key, standalone = true) {
  let typesCode = ''
  if (standalone) {
    typesCode += getComponentTypesCodeImport('@json-layout/vocabulary/normalized-layout/types.js')
  }
  typesCode += await compileTs(schema, key, compileTsOptions)
  return typesCode
}
