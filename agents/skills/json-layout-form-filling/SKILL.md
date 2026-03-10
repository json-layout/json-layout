---
name: json-layout-form-filling
description: "How to use json-layout MCP tools to compile JSON Schemas, create stateful forms, fill them with data, handle validation errors, and extract results. Use this skill whenever you need to interact with json-layout tools — whether filling a form, navigating complex schemas with oneOf/allOf/if-then-else, selecting from enums, fixing validation errors, or working with arrays and recursive structures. Also use it when the user asks you to fill out a form from a JSON Schema, even if they don't mention json-layout explicitly."
---

# JSON Layout Form-Filling Guide

This skill teaches you how to use the json-layout MCP tools to fill forms defined by JSON Schemas. The tools let you compile a schema, create a stateful form, inspect its structure, fill fields, fix validation errors, and extract the final data.

## Workflow

Follow this sequence for every form-filling task:

1. **compile** — Pass the JSON Schema (and options if needed). Check for errors.
2. **createState** — Pass the compiled ID (and initial data if available). You get back the state tree.
3. **describeState** — Read the projected state tree to understand the form structure: what fields exist, their types, whether they're required, and what constraints apply.
4. **getFieldSuggestions** — For any `select`, `autocomplete`, `one-of-select`, `combobox`, `checkbox-group`, `radio-group`, or `switch-group` field, call this before filling to discover valid options.
5. **setData** — Bulk-set plausible values as a first attempt. Build the data object to match the tree structure.
6. **Fix errors** — If `valid` is false, read the `errors` array. Each error has a `path` and `message`. Use `setFieldValue` to fix individual fields.
7. **validateState** — Confirm the form is fully valid.
8. **getData** — Extract the final result.
9. **destroy** — Free the compiled layout and state by passing both IDs.

## Reading the State Tree

`createState` and `describeState` return a projected tree. Each node has:

| Property | Meaning |
|----------|---------|
| `key` | Property name or array index |
| `path` | Full path, used with `setFieldValue` and `describeState` |
| `comp` | Component type (`text-field`, `select`, `slider`, `one-of-select`, etc.) |
| `data` | Current value (absent if empty) |
| `label` | Field label (on leaf fields) |
| `title` | Section/tab title (on containers) |
| `error` | Validation error message (only if invalid) |
| `childError` | `true` if any descendant has an error — useful for locating problems in tabs/panels |
| `required` | `true` if the field is required |
| `readOnly` | `true` if the field is read-only |
| `constraints` | Component-specific limits (see below) |
| `oneOfItems` | Available variants for `one-of-select` nodes (see below) |
| `children` | Nested child nodes |

### Constraints

Leaf nodes may include a `constraints` object with validation-relevant properties extracted from the schema:

- **number-field**: `min`, `max`, `step`, `precision`
- **slider**: `min`, `max`, `step`
- **date-picker**: `min`, `max`, `format` (`"date"` or `"date-time"`)
- **date-time-picker** / **time-picker**: `min`, `max`
- **combobox** / **number-combobox**: `separator`

Example: a slider with `constraints: { min: 0, max: 100 }` means the value must be between 0 and 100.

If `constraints` is absent, there are no component-level limits (though ajv may still enforce schema rules like `pattern` or `minLength` — those appear only as error messages).

## Path Conventions

Paths use JSON Pointer syntax with some synthetic segments for composite schemas:

### Simple properties
```
/name          — top-level property "name"
/address/city  — nested property
```

### Arrays
```
/items/0       — first array item
/items/1/name  — "name" inside second array item
```

### oneOf (variant selection)
```
/$oneOf           — the variant selector node
/$oneOf/0/str1    — field "str1" inside first variant
/$oneOf/1/str2    — field "str2" inside second variant
```

### allOf (merged sections)
```
/$allOf-0/str1    — field "str1" in first allOf section
/$allOf-1/str2    — field "str2" in second allOf section
```

### dependentSchemas / if-then-else
```
/$deps-str1             — dependent schema triggered by "str1"
/$deps-str1/str2        — field "str2" in the dependent section
/$deps-str1/$then/str2  — field "str2" in the "then" branch
/$deps-str1/$else/str3  — field "str3" in the "else" branch
```

The key rule: always use the `path` values from `describeState` output rather than guessing.

## Filling Strategies

### Bulk first, fix later

Use `setData` for the initial fill — it's more efficient than setting fields one by one. Build a data object matching the schema structure:

```json
{
  "name": "Alice",
  "address": { "street": "123 Main St", "city": "Springfield" },
  "tags": ["important", "reviewed"]
}
```

Then use `setFieldValue` only for targeted fixes after reading validation errors.

### Selection fields

Before filling any selection field, call `getFieldSuggestions` with its path:

```
getFieldSuggestions({ stateId, path: "/status" })
-> { items: [{ value: "active", title: "Active" }, { value: "inactive", title: "Inactive" }] }
```

Then set the field value to one of the returned `value` properties.

For `autocomplete` fields with server-side filtering, pass a `query`:
```
getFieldSuggestions({ stateId, path: "/dataset", query: "sales" })
```

### Combobox fields

Combobox fields accept both suggested values and custom values. Call `getFieldSuggestions` to see suggestions, but you can also set any free-text value.

For array comboboxes, set the value as an array: `["tag1", "tag2", "tag3"]`.

For separator-based comboboxes (check `constraints.separator`), set the value as a delimited string: `"one,two,three"`.

## Handling oneOf Variants

When you see a `one-of-select` node in the state tree, it represents a polymorphic choice.

### Discovering variants

The node includes `oneOfItems` listing the available branches:
```json
{
  "comp": "one-of-select",
  "oneOfItems": [
    { "key": 0, "title": "Person" },
    { "key": 1, "title": "Company" }
  ]
}
```

You can also call `getFieldSuggestions` on the oneOf path:
```
getFieldSuggestions({ stateId, path: "/$oneOf" })
-> { items: [{ value: 0, title: "Person" }, { value: 1, title: "Company" }] }
```

### Selecting a variant

Use `setFieldValue` with the variant **index** (not the title):
```
setFieldValue({ stateId, path: "/$oneOf", value: 0 })
```

This activates variant 0 and reveals its child fields. Call `describeState` after switching to see the new form structure — the children and their paths change with each variant.

### Filling variant fields

After selecting a variant, the child fields appear under the variant's path:
```
/$oneOf/0/name     — fill "name" in variant 0
/$oneOf/0/email    — fill "email" in variant 0
```

If you switch variants, the previous variant's data may persist in the underlying object. This is normal — only the active variant's fields are validated.

## Editable Lists

Array-of-objects fields render as `list` components. Items may appear with `readOnly: true` — this is normal display behavior (items show in "view mode" in the UI). Use `setData` to populate list items; the data is accepted regardless of the readOnly display flag:

```json
{
  "people": [
    { "name": "Alice", "role": "Engineer" },
    { "name": "Bob", "role": "Designer" }
  ]
}
```

## Conditional Fields

Fields may appear or disappear based on other field values:

- **dependentSchemas**: a field appears when another field has a value
- **if/then/else**: different fields appear based on conditions

After changing a field that might trigger conditional logic, call `describeState` to see the updated tree structure. New fields will have new paths — read them from the response rather than assuming.

## Error Recovery

When `setData` or `setFieldValue` returns `valid: false`:

1. Read the `errors` array — each entry has `path` and `message`
2. Match each `path` to the field that needs fixing
3. Use `setFieldValue` with the error's path to set a corrected value
4. The response includes the updated state — check if `valid` is now `true`

Common error messages and fixes:
- `"required information"` — the field is required but empty; set a value
- `"must match pattern \"^[A-Z]+$\""` — value doesn't match the regex; adjust accordingly
- `"must match format \"time\""` — time values need RFC 3339 format with timezone: `"14:30:00+00:00"` not `"14:30:00"`
- `"must match format \"date\""` — use ISO 8601: `"2025-06-15"`
- `"must match format \"date-time\""` — use ISO 8601 with time: `"2025-06-15T14:30:00Z"`

## Common Pitfalls

1. **Time format requires timezone offset**: `format: "time"` needs `"HH:MM:SS+HH:MM"` or `"HH:MM:SSZ"`, not bare `"HH:MM:SS"`.

2. **Pattern and length constraints are only visible via errors**: Unlike `min`/`max` which appear in `constraints`, schema keywords like `pattern`, `minLength`, `maxLength`, `minItems`, `maxItems` are enforced by validation but not surfaced in the state tree. You'll learn about them from error messages.

3. **List items display as readOnly**: Object array items in `list` components show `readOnly: true` in their default display. This doesn't prevent you from setting data via `setData` — it's a UI display concern only.

4. **describeState after variant switches**: After calling `setFieldValue` on a `/$oneOf` path, the children array changes. Always read the response or call `describeState` to discover the new field paths.

5. **Cleanup**: Always call `destroy` with both `compiledId` and `stateId` when done. This frees server-side resources.
