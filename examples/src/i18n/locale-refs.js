/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Locale refs',
  id: 'locale-refs',
  description: `Schemas can contain internationalized content thanks to a conventional \`~$locale~\` variable in ref paths.
  
These refs will be resolved by replacing \`~$locale~\` with the current locale, and if the resolution fails it will be attempted again with the defaultLocale option.

Warning: this resolution method is not a part of JSON schema or any other specification, schemas that use it will be incompatible with other tooling. You might want to use our method \`resolveLocaleRefs\` in your code:

\`\`\`js
import { resolveLocaleRefs } from '@json-layout/core
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
      fr: { str1: 'Texte 1' }
    }
  },
  options: {
    locale: 'fr',
    defaultLocale: 'en'
  }
}

export default example
