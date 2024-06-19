/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Schemas',
  id: 'schemas',
  description: `Schemas can contain internationalized labels thanks to a conventional \`~$locale~\` variable in ref paths.
  
These refs will be resolved by replacing \`~$locale~\` with the current locale, and if the resolution fails it will attempted again with *en*.

Warning: this resolution method is not a part of JSON schema or any other specification, schemas that use it will be incompatible with other tooling. You might want to use our method \`resolveLocaleRefs\` in your code:

\`\`\`js
import {resolveLocaleRefs} from '@json-layout/core
resolveLocaleRefs(schema, ajv, locale)
\`\`\`
`,
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: {
        type: 'string',
        title: { $ref: '#/i18n/~$locale~/str1' },
        pattern: '^[A-Z]+$'
      }
    },
    i18n: {
      en: { str1: 'String 1' },
      fr: { str1: 'Chaîne de caractères 1' }
    }
  },
  options: {
    locale: 'fr'
  }
}

export default example
