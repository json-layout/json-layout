/**
 * Curated examples for the dev/doc app. Each entry is rendered at /json-edition/:id
 * and drives the full editor wiring (compile → StatefulLayout → CM6 extensions).
 *
 * Teaching notes are rendered above the editor so the user knows what to try.
 */

/**
 * @typedef {object} Example
 * @property {string} id — URL slug and test id.
 * @property {string} title — shown in nav.
 * @property {string} summary — one-liner, shown under title in nav.
 * @property {object} schema — raw JSON Schema passed to `compile`.
 * @property {unknown} initialData — initial `StatefulLayout` data.
 * @property {object} [statefulLayoutOptions] - merged into StatefulLayout options (e.g. context for getItems).
 * @property {string[]} teachingNotes — rendered above the editor.
 */

/** @type {Example[]} */
const examples = [
  {
    id: 'basic',
    title: 'Basic value completion',
    summary: 'Enum + title/description on a leaf field.',
    schema: {
      type: 'object',
      title: 'Traffic light',
      properties: {
        color: {
          type: 'string',
          title: 'Colour',
          description: 'Which lamp is currently lit.',
          enum: ['red', 'amber', 'green'],
        },
      },
    },
    initialData: { color: 'red' },
    teachingNotes: [
      'Place the cursor inside the empty string value for `color` and press Ctrl+Space — three completions (red, amber, green) should appear.',
      'Hover anywhere on the `color` key or value — the tooltip should show "Colour" and the description.',
    ],
  },
  {
    id: 'required-nested',
    title: 'Required property scaffold',
    summary: 'Completion inserts nested required defaults.',
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
            retries: { type: 'integer', default: 3 },
          },
        },
      },
    },
    initialData: {},
    teachingNotes: [
      'Start with an empty object `{}` — place the cursor between the braces, open completion, pick `cfg`.',
      'The inserted text should include `"cfg": {"enabled": true, "retries": 3}` — scaffoldDefault fills the required nested shape.',
    ],
  },
  {
    id: 'one-of-variants',
    title: 'oneOf variant picker',
    summary: 'Discriminator-aware variant scaffolding.',
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
                content: { type: 'string', default: '...' },
              },
              required: ['content'],
            },
            {
              title: 'Number',
              properties: {
                kind: { const: 'number' },
                value: { type: 'integer', default: 0 },
              },
              required: ['value'],
            },
          ],
        },
      },
    },
    initialData: { payload: { kind: 'text', content: 'hi' } },
    teachingNotes: [
      'Select the whole `payload` object value, then open completion — two variant candidates (Text, Number) should appear.',
      'Picking `Number` should replace the value with `{"kind": "number", "value": 0}`.',
    ],
  },
  {
    id: 'get-items',
    title: 'Dynamic getItems',
    summary: 'Async completion via the committed path.',
    schema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          title: 'Country',
          layout: {
            getItems: 'options.context.countries',
          },
        },
      },
    },
    initialData: { country: '' },
    statefulLayoutOptions: {
      context: { countries: ['France', 'Germany', 'Italy', 'Spain', 'Portugal'] },
    },
    teachingNotes: [
      'Place the cursor inside the empty `country` value and open completion. Candidates flow through the committed path (250ms debounce).',
      'After a short pause you should see France/Germany/Italy/Spain/Portugal in the completion menu.',
    ],
  },
]

export default examples
