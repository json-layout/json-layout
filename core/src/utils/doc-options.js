import en from '../i18n/en.js'

/**
 * @typedef {{key: string, description: string, default?: any, values?: Record<string, any>}[]} DocOptions
 */

/** @type {DocOptions} */
export const compileOptions = [
  {
    key: 'ajv',
    description: 'The Ajv instance to use, you should probably no overwrite this option and let Vjsf handle the Ajv instance.'
  },
  {
    key: 'ajvOptions',
    description: 'Some options for the Ajv instance that will be created by default.',
    default: { allErrors: true, strict: false }
  },
  {
    key: 'markdown',
    description: 'A function that takes a string in markdown format and returns HTML code.',
    default: 'A markdown-it instance render function'
  },
  {
    key: 'markdownItOptions',
    description: 'Some options for the markdown-it instance that will be created by default',
    default: {}
  },
  {
    key: 'locale',
    description: 'The locale of the form.',
    default: 'en'
  },
  {
    key: 'messages',
    description: 'The locale messages. You wan overwrite only the key you want to change.',
    default: en
  }
]

/** @type {DocOptions} */
export const runtimeOptions = [
  {
    key: 'readOnly',
    description: 'Render the form in read-only mode.',
    default: false
  },
  {
    key: 'summary',
    description: 'Render the form in summary mode. In this mode some information may be omitted for the sake of information density and readability. Items in an editable array are rendered in this mode.',
    default: false
  },
  {
    key: 'density',
    description: 'Matches the density concept of Material design.',
    default: 'default',
    values: {
      default: 'default',
      compact: 'compact',
      comfortable: 'comfortable'
    }
  },
  {
    key: 'context',
    description: 'A contextual data object that can be referenced in expressions',
    default: {}
  },
  {
    key: 'titleDepth',
    description: 'The depth of the section titles (an initial depth of 2 means that the first level of titles will be rendered as h2 tags)',
    default: 2
  },
  {
    key: 'validateOn',
    description: 'Control the way form inputs are validated. It does not control the actual execution of a validation function (data is always validated as it changes), only the display of the validation errors to the users.',
    default: 'input',
    values: {
      input: 'Validate a form input as soon as the user used it to input some data.',
      blur: 'Validate a form input when the user interacts with it then leaves it.',
      submit: 'Validate the form inputs only when the form is submitted.'
    }
  },
  {
    key: 'initialValidation',
    description: 'This option complements "validateOn". It controls the validation of form inputs when the form is initialized.',
    default: 'withData',
    values: {
      never: 'Form inputs are never validated at initialization.',
      always: 'Form inputs are always validated at initialization',
      withData: 'Only the inputs with data at initialization are validated.'
    }
  },
  {
    key: 'defaultOn',
    description: 'Control the use of default values in the form.',
    default: 'empty',
    values: {
      never: 'Never use the default data',
      missing: 'The default data is used when the property if not defined in the data.',
      empty: 'The default data is used when the property is either undefined of defined but empty (empty string, empty object, etc.).'
    }
  },
  {
    key: 'removeAdditional',
    description: 'Control the way additional data is managed (data that is present in the model but not defined by the schema).',
    default: 'error',
    values: {
      true: 'Remove all additional properties (alias "unknown")',
      error: 'Remove additional properties that cause a validation error',
      false: 'Never remove additional properties (alias "none")'
    }
  },
  {
    key: 'autofocus',
    description: 'Activate autofocus. The focus will be given to the first input of the form.',
    default: false
  }
]