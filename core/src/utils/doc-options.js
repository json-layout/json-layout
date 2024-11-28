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
    default: 'A function using the marked parser'
  },
  {
    key: 'markedOptions',
    description: 'Some options for the default <a href="https://marked.js.org/using_advanced#options">marked</a> parser',
    default: {}
  },
  {
    key: 'locale',
    description: 'The locale of the form.',
    default: 'en'
  },
  {
    key: 'messages',
    description: 'The locale messages. You can overwrite only the keys you want to change.',
    default: {},
    values: en
  },
  {
    key: 'xI18n',
    description: 'Activate x-i18n-* annotation system.',
    default: false
  },
  {
    key: 'useDescription',
    description: 'Define how to use the "description" metadata from the schema.',
    default: ['help', 'subtitle'],
    values: {
      help: 'As a help message shown in a tooltip.',
      hint: 'As a hint message blow simple form fields (not applicable to composite components).',
      subtitle: 'As a subtitle below the title of a composite component.'
    }
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
    key: 'indent',
    description: 'The indentation of the nested sections of the form.',
    default: false,
    values: {
      true: 'The nested sections are indented.',
      false: 'The nested sections are not indented.',
      number: 'The nested sections are indented with the given number of spaces.'
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
    key: 'updateOn',
    description: 'Control when the new data will be emitted by the form.',
    default: 'input',
    values: {
      input: 'The data will be updated in realtime when the user makes any input (except for the application of debounceInputMs).',
      blur: 'The data will be updated only when the user interacts with a form input then leaves it.'
    }
  },
  {
    key: 'debounceInputMs',
    description: 'The debounce time for the input event of editable fields.',
    default: 300
  },
  {
    key: 'defaultOn',
    description: 'Control the use of default values in the form.',
    default: 'empty',
    values: {
      never: 'Never use the default data.',
      missing: 'The default data is used when the property is not defined in the data.',
      empty: 'The default data is used when the property is either undefined or empty (empty string, empty object, etc.).'
    }
  },
  {
    key: 'removeAdditional',
    description: 'Control the way additional data is managed (data that is present in the model but not defined by the schema).',
    default: 'error',
    values: {
      true: 'Remove all additional properties (alias "unknown").',
      error: 'Remove additional properties that cause a validation error.',
      false: 'Never remove additional properties (alias "none").'
    }
  },
  {
    key: 'readOnlyPropertiesMode',
    description: 'Control the way readOnly properties from the schema are managed.',
    default: 'show',
    values: {
      remove: 'Hide the readOnly properties and remove them from the data.',
      hide: 'Hide the readOnly properties but keep them in the data.',
      show: 'Show the readOnly properties.'
    }
  },
  {
    key: 'autofocus',
    description: 'Activate autofocus. The focus will be given to the first input of the form.',
    default: false
  },
  {
    key: 'fetchOptions',
    description: 'Define options to be given to <a href="https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch">fetch</a> when getting data items from a URL. Can also be a function that will accept a URL object as parameter and return those options.'
  }
]
