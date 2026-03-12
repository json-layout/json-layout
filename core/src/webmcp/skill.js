/**
 * @file Skill generation for webmcp tools
 */

/**
 * Generate skill content with dataTitle injected
 * @param {string} dataTitle
 * @returns {string}
 */
export function generateSkill (dataTitle) {
  return `# JSON ${dataTitle.charAt(0).toUpperCase() + dataTitle.slice(1)} Form-Filling Guide

This guide teaches you how to use json-layout MCP tools to fill forms defined by JSON Schemas.

## Workflow

1. **describeState** — Read the projected state tree to understand the ${dataTitle} structure
2. **getFieldSuggestions** — For any select/autocomplete/oneOf field, discover valid options
3. **setData** — Bulk-set plausible values as a first attempt
4. **Fix errors** — If valid is false, read errors and use setFieldValue to fix fields
5. **validateState** — Confirm the form is fully valid
6. **getData** — Extract the final result

## State Tree

Each node has:

| Property | Meaning |
|----------|---------|
| key | Property name or array index |
| path | Full path for tool calls |
| comp | Component type (text-field, select, slider, etc.) |
| data | Current value |
| label | Field label |
| title | Section/tab title |
| error | Validation error message |
| childError | true if any descendant has error |
| required | true if field is required |
| readOnly | true if field is read-only |
| constraints | Component-specific limits |
| oneOfItems | Available variants for oneOf nodes |
| children | Nested child nodes |

## Path Conventions

- Simple: \`/name\`, \`/address/city\`
- Arrays: \`/items/0\`, \`/items/1/name\`
- oneOf: \`/$oneOf\`, \`/$oneOf/0/str1\`
- allOf: \`/$allOf-0/str1\`
- dependentSchemas: \`/$deps-str1\`, \`/$deps-str1/str2\`

## Constraints

- **number-field/slider**: min, max, step
- **date-picker**: min, max, format
- **combobox**: separator

## Filling Strategies

### Selection fields
Call getFieldSuggestions first to discover valid options, then set the value to one of the returned \`value\` properties.

### oneOf variants
Use setFieldValue with the variant index: \`{ path: "/$oneOf", value: 0 }\`. The children paths change after selecting a variant.

### Bulk first, fix later
Use setData for initial fill, setFieldValue only for targeted fixes.

## Error Recovery

When valid is false:
1. Read errors array — each has path and message
2. Use setFieldValue with the error path to fix
3. Check if valid is now true

## Common Errors

- \`required information\`: field is empty
- \`must match pattern "..."\`: value doesn't match regex
- \`must match format "time"\`: use RFC 3339 format with timezone
- \`must match format "date"\`: use ISO 8601
- \`must match format "date-time"\`: use ISO 8601 with time
`
}
