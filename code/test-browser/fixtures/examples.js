/**
 * Curated examples used by the browser harness. Mirror of the four curated
 * entries in doc/examples/index.js (with one corrected fixture — see get-items
 * below). Kept as a local copy so the @json-layout/code workspace does not
 * depend on doc/. Consolidation into a shared source is a future change.
 * @typedef {object} Example
 * @property {string} id — slug used by tests and by url when the harness is opened in a browser.
 * @property {object} schema — JSON Schema passed to compile.
 * @property {unknown} initialData — initial StatefulLayout data.
 * @property {object} [layoutOptions] — merged into StatefulLayout options (e.g. { context: {...} }).
 */

/** @type {Record<string, Example>} */
export const examples = {
  basic: {
    id: 'basic',
    schema: {
      type: 'object',
      title: 'Traffic light',
      properties: {
        color: {
          type: 'string',
          title: 'Colour',
          description: 'Which lamp is currently lit.',
          enum: ['red', 'amber', 'green']
        }
      }
    },
    initialData: { color: 'red' }
  },
  'required-nested': {
    id: 'required-nested',
    schema: {
      type: 'object',
      required: ['cfg'],
      properties: {
        cfg: {
          type: 'object',
          title: 'Configuration',
          required: ['enabled', 'retries'],
          properties: {
            enabled: { type: 'boolean', default: true },
            retries: { type: 'integer', default: 3 }
          }
        }
      }
    },
    initialData: {}
  },
  'one-of-variants': {
    id: 'one-of-variants',
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              title: 'Text',
              properties: {
                kind: { const: 'text' },
                content: { type: 'string', default: '...' }
              },
              required: ['content']
            },
            {
              title: 'Number',
              properties: {
                kind: { const: 'number' },
                value: { type: 'integer', default: 0 }
              },
              required: ['value']
            }
          ]
        }
      }
    },
    initialData: { payload: { kind: 'text', content: 'hi' } }
  },
  // The original doc/examples/index.js fixture used `getItems: [array]`, which
  // the vocabulary schema does not accept (getItems is a string expression or
  // a get-items object — see vocabulary/src/layout-keyword/schema.json:171).
  // Here we use an expression that reads from the StatefulLayout context, which
  // is the normal way to feed runtime-known items into dynamic completion.
  'get-items': {
    id: 'get-items',
    schema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          title: 'Country',
          layout: {
            getItems: 'options.context.countries'
          }
        }
      }
    },
    initialData: { country: '' },
    layoutOptions: {
      context: { countries: ['France', 'Germany', 'Italy', 'Spain', 'Portugal'] }
    }
  }
}
