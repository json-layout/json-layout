/**
 * @file fillFormSkill tool
 */

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get guidance on how to interact with the form "${dataTitle}" using the available tools.`
}

/**
 * The one path. There used to be three, chosen by counting normalized layouts and calling
 * the result small, medium or large — a threshold nobody could justify, measuring the
 * schema when the question was about data, and duplicated between here and index.js. Four
 * commits in a row went to fixing contradictions between those branches, and across four
 * recorded baselines the small and medium advice was never taken on a real form: setData
 * was used zero times and getSchema once.
 *
 * `guide` is the per-entity guide a schema carries in its root `x-agent-guide` annotation
 * (compiledLayout.agentGuide): what the fields of this kind of document mean, its
 * conventions and traps — knowledge json-layout cannot derive from the schema itself.
 * @param {string} dataTitle
 * @param {string} prefixName
 * @param {{ guide?: string, screen?: boolean }} [options] - screen: false for a form edited with no
 * screen, whose guide says nothing of open tabs
 * @returns {string}
 */
export function generateSkill (dataTitle, prefixName, options = {}) {
  const { guide, screen = true } = options
  // a form edited with no screen (a server-side session) has no open tab to tell or change
  const sections = screen
    ? `A form laid out in tabs or steps shows one at a time: describeState marks the one on the person's screen (open), and writing a field opens the one that holds it and says what is now on screen. To show the person another part of the form without changing it, call ${prefixName}openSection with its path or the path of a field it holds.

`
    : ''
  const about = typeof guide === 'string' && guide.trim()
    ? `

## About this ${dataTitle}

${guide.trim()}
`
    : ''

  return `# JSON ${dataTitle.charAt(0).toUpperCase() + dataTitle.slice(1)} Form-Filling Guide

This guide teaches you how to use tools to fill the data of a form in the user's page.
${about}
Start with ${prefixName}describeState. It lists every field with its path, its current value and anything invalid; a value too large to inline is shown as its type and size, with the path to read it. Call it again on a path whenever you need to look at one part of the form. Every tool also accepts the data path of a value, as getData shows it (/theme/colors/primary), when you do not have its listed path.

Then write. If the goal already tells you every value, set them in one call with ${prefixName}setData. Otherwise change one field at a time with ${prefixName}setFieldValue, which is also what you need when a value has to be looked up first or when a field only exists once another has been set. Every write reports whether the form is valid and lists what is wrong, so you rarely need to read anything back.

Never invent a value for a field that has a fixed set of accepted ones. ${prefixName}describeState tells you which case you are in: it either states them on the field's line as values=[...], and you write one of those directly, or it marks the field "suggestions", and the list exists only behind a request — then call ${prefixName}getFieldSuggestions, whose description says how to apply what it returns.

A field shown as (variant-selector) chooses between shapes rather than between values: ${prefixName}describeState lists its branches under it as "variant N: label", and you switch to one by setting the field to that number with ${prefixName}setFieldValue, which then lists the fields the branch contains.

To fill an array, call ${prefixName}editArray with action "add": the new item is activated for edition and the tool returns the fields it contains, then fill them one by one with ${prefixName}setFieldValue.

${sections}${prefixName}getData returns the data document itself, whole or one part of it by path, for when you need the values rather than a description of them.

The errors returned by ${prefixName}setFieldValue and ${prefixName}editArray are scoped to the node you just modified, other errors of the form are only counted.
`
}
