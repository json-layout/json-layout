/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Dates',
  id: 'date',
  description: `There are default components for the standard \`date\`, \`time\` and \`date-time\` formats.

  Notes about timezone management:
  - Date-Times are stored with the user's timezone offset (for example 2020-04-03T21:07:43+02:00 instead of the usual result of \`toISOString\` 2020-04-03T19:07:43.152Z, this gives more contextual information to your application
  - Times alone are stored without representing the offset but also without applying it in the first place. Meaning that if the user select 00:00 we will store 00:00:00Z whatever his timezone. This is because without the context of a date timezone management becomes meaningless.
  `,
  schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        title: 'A date picker'
      },
      time: {
        type: 'string',
        format: 'time',
        title: 'A time picker'
      },
      dateTime: {
        type: 'string',
        format: 'date-time',
        title: 'A date-time picker'
      },
      dateTimeShort: {
        type: 'string',
        format: 'date-time',
        layout: 'date-picker',
        title: 'A date picker with a date-time format'
      }
    }
  }
}

export default example
