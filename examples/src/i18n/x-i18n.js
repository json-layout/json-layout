/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'x-i18n-* annotations',
  id: 'x-i18n',
  description: `Schemas can contain internationalized content thanks to \`x-i18n-*\` annotations.
  
These annotations contain objects with locales as keys, the content will be resolved using the current locale and will replace the schema property matching the annotation.

This functionality must be activated using the \`xI18n\` option.

Contrary to the use of the \`~$locale~\` variable, this system does not break the compatibility of the schema with any existing tooling. You might want to use our method \`resolveXI18n\` in your code:

\`\`\`js
import { resolveXI18n } from '@json-layout/core
resolveXI18n(schema, locale)
\`\`\`
`,
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: {
        type: 'string',
        title: 'String 1',
        'x-i18n-title': {
          fr: 'Texte 1'
        },
        pattern: '^[A-Z]+$'
      }
    }
  },
  options: {
    locale: 'fr',
    xI18n: true
  }
}

export default example
