# JSON Layout Agent Toolkit — Real-world Evaluation

You are evaluating the `json-layout` MCP tools by acting as a **form-filling agent**. Your job is to work through a series of JSON Schema examples, using the MCP tools to compile each schema, create a stateful form, fill it with plausible data, fix validation errors, and extract the final result.

## Available MCP tools

| Tool | Purpose |
|------|---------|
| `compile` | Compile a JSON Schema into a layout. Returns `id` + any schema errors. |
| `createState` | Create a stateful form from a compiled layout. Returns `stateId` + the projected state tree. |
| `describeState` | Inspect the current state tree (full or subtree by `path`). |
| `setData` | Bulk-set the entire form data. Returns updated state + errors. |
| `setFieldValue` | Set a single field by path (e.g. `/name`, `/items/0/str1`). |
| `getFieldSuggestions` | Get available options for select/autocomplete fields. |
| `validateState` | Trigger full validation, get all errors. |
| `getData` | Get current data + validity. |
| `destroy` | Free stored compiled/state objects by ID. |

## Workflow for each example

For each example schema below, follow this process:

1. **Compile** the schema (with options if specified). Check for compilation errors.
2. **Create state** from the compiled layout. If the example provides initial `data`, pass it.
3. **Describe state** — read the projected state tree. Understand the form structure: what fields exist, what types/components they use, whether they are required.
4. **Fill the form** — use `setData` for a first attempt with plausible values. If there are select/enum fields, use `getFieldSuggestions` first to discover valid options.
5. **Check errors** — if validation fails, read the errors, understand what went wrong, and fix with `setFieldValue` or another `setData`.
6. **Validate** — call `validateState` to confirm the form is valid.
7. **Extract** — call `getData` to get the final result.
8. **Cleanup** — call `destroy` to free the compiled layout and state.

After each example, report:
- Whether you succeeded (valid data produced)
- Any difficulties (unclear state tree, missing information, confusing tool output)
- What additional information would have helped

## Evaluation levels

Work through these levels in order. Stop and report findings if you hit blockers.

---

### Level 1 — Basic fields

These test simple scalar field filling.

#### 1.1 Strings (`simple-properties/string`)

```json
{
  "type": "object",
  "properties": {
    "text": { "type": "string", "title": "A simple string property", "description": "A description displayed in a help message" },
    "textarea": { "type": "string", "title": "A string in a textarea", "layout": "textarea" }
  }
}
```

Goal: fill both fields with any text.

#### 1.2 Booleans (`simple-properties/boolean`)

```json
{
  "type": "object",
  "properties": {
    "checkbox": { "type": "boolean", "title": "A simple boolean property" },
    "switch": { "type": "boolean", "title": "A boolean in a switch", "layout": "switch" }
  }
}
```

Goal: set one to `true`, one to `false`.

#### 1.3 Numbers (`simple-properties/number`)

```json
{
  "type": "object",
  "properties": {
    "num": { "type": "number", "title": "A simple number property" },
    "int": { "type": "integer", "title": "A simple integer property" },
    "slider": { "type": "integer", "title": "An integer in a slider", "minimum": 0, "maximum": 100, "layout": "slider" }
  }
}
```

Goal: fill all three. The slider must be between 0 and 100.

#### 1.4 Dates (`formats/date`)

```json
{
  "type": "object",
  "properties": {
    "date": { "type": "string", "format": "date", "title": "A date picker" },
    "time": { "type": "string", "format": "time", "title": "A time picker" },
    "dateTime": { "type": "string", "format": "date-time", "title": "A date-time picker" },
    "dateTimeShort": { "type": "string", "format": "date-time", "title": "A date picker with a date-time format", "layout": "date-picker" }
  }
}
```

Goal: fill all four with valid formatted strings (ISO 8601).

#### 1.5 Colors (`formats/color`)

```json
{
  "type": "object",
  "properties": {
    "color": { "type": "string", "title": "A color", "layout": "color-picker" }
  }
}
```

Goal: set a valid color value (e.g. `"#ff5733"`).

---

### Level 2 — Selection and enums

These test selecting from predefined options.

#### 2.1 Enums and oneOfs (`selection/enum-one-of`)

```json
{
  "type": "object",
  "properties": {
    "enum": { "type": "string", "title": "An enum", "enum": ["value1", "value2"] },
    "largeEnum": { "type": "string", "title": "A large enum", "enum": ["value1","value2","value3","value4","value5","value6","value7","value8","value9","value10","value11","value12","value13","value14","value15","value16","value17","value18","value19","value20","value21"] },
    "oneOf": { "type": "string", "title": "A oneOf", "oneOf": [{"const": "value1", "title": "Value 1"}, {"const": "value2", "title": "Value 2"}] },
    "oneOfArray": { "type": "array", "title": "An array of oneOf", "items": { "type": "string", "oneOf": [{"const": "value1", "title": "Value 1"}, {"const": "value2", "title": "Value 2"}] } }
  }
}
```

Goal: use `getFieldSuggestions` to discover options, then select valid values for each field. For `oneOfArray`, select multiple values.

#### 2.2 Opened selection / combobox (`selection/examples-combobox`)

```json
{
  "type": "object",
  "properties": {
    "examplesString": { "type": "string", "title": "A string with examples", "examples": ["example1", "example2"] },
    "examplesArray": { "type": "array", "title": "An array with examples", "items": { "type": "string", "examples": ["example1", "example2"] } },
    "fromLayoutString": { "type": "string", "title": "A string with items defined in layout and explicit component", "layout": {"comp": "combobox", "items": ["example1", "example2"]} }
  }
}
```

Goal: for combobox fields, you can pick from suggestions OR type a custom value. Try both.

#### 2.3 Groups (`selection/groups`)

```json
{
  "type": "object",
  "required": ["radioOneOfs"],
  "properties": {
    "checkboxOneOfs": { "type": "string", "title": "Items rendered as checkboxes", "oneOf": [{"const":"value1","title":"Value 1"},{"const":"value2","title":"Value 2"}], "layout": "checkbox-group" },
    "switchOneOfs": { "type": "string", "title": "Items rendered as switches", "oneOf": [{"const":"value1","title":"Value 1"},{"const":"value2","title":"Value 2"}], "layout": "switch-group" },
    "radioOneOfs": { "type": "string", "title": "Items rendered as radio buttons", "oneOf": [{"const":"value1","title":"Value 1"},{"const":"value2","title":"Value 2"}], "layout": "radio-group" },
    "checkboxOneOfsArray": { "type": "array", "title": "Array rendered as checkboxes", "items": { "type": "string", "oneOf": [{"const":"value1","title":"Value 1"},{"const":"value2","title":"Value 2"}] }, "layout": "checkbox-group" }
  }
}
```

Goal: `radioOneOfs` is required. Use `getFieldSuggestions`, fill all fields, validate.

#### 2.4 Items from HTTP (`selection/http`)

```json
{
  "type": "object",
  "properties": {
    "fromUrl": {
      "type": "string",
      "title": "A select from a URL",
      "layout": {
        "getItems": {
          "url": "https://koumoul.com/data-fair/api/v1/datasets?status=finalized&select=id,title&owner=${context.owner.type}:${context.owner.id}",
          "itemsResults": "data.results",
          "itemTitle": "item.title",
          "itemValue": "item.id"
        }
      }
    },
    "fromUrlWithQ": {
      "type": "object",
      "title": "A autocomplete from a URL with a query",
      "layout": {
        "getItems": {
          "url": "https://koumoul.com/data-fair/api/v1/datasets?status=finalized&select=id,title&q={q}&owner=${context.owner.type}:${context.owner.id}",
          "itemsResults": "data.results",
          "itemTitle": "item.title",
          "itemKey": "item.id"
        }
      }
    }
  }
}
```

Options (pass to compile):
```json
{ "context": { "owner": { "type": "organization", "id": "5a5dc47163ebd4a6f438589b" } } }
```

Goal: use `getFieldSuggestions` (with a `query` for the autocomplete field) to fetch live data from the API, then select values.

---

### Level 3 — Validation and error handling

#### 3.1 Simple errors (`validation/simple-errors`)

```json
{
  "type": "object",
  "required": ["str1"],
  "properties": {
    "str1": { "type": "string", "title": "A string property that only accepts uppercase letters", "pattern": "^[A-Z]+$" }
  }
}
```

Options: `{ "initialValidation": "always" }`

Goal: first set an invalid value (lowercase), observe the error, then fix it with an uppercase value.

#### 3.2 Custom error messages (`validation/error-messages`)

```json
{
  "type": "object",
  "required": ["str1"],
  "properties": {
    "str1": { "type": "string", "title": "A string property that only accepts uppercase letters", "pattern": "^[A-Z]+$", "errorMessage": "use uppercase letters only" }
  }
}
```

Options: `{ "initialValidation": "always" }`

Goal: same as above, but verify that the custom error message appears.

#### 3.3 Composite errors (`validation/composite-errors`)

```json
{
  "type": "object",
  "layout": "tabs",
  "required": ["tab1", "tab2"],
  "properties": {
    "tab1": { "type": "object", "required": ["str1"], "title": "Tab 1", "properties": { "str1": { "type": "string", "pattern": "^[A-Z]+$" } } },
    "tab2": { "type": "object", "required": ["str2"], "title": "Tab 2", "properties": { "str2": { "type": "string", "pattern": "^[A-Z]+$" } } }
  }
}
```

Options: `{ "initialValidation": "always" }`

Goal: errors span multiple tabs. Use `describeState` with paths to navigate tabs, fix errors in each tab separately.

---

### Level 4 — Composite layouts

#### 4.1 Sections (`composite/sections`)

```json
{
  "type": "object",
  "title": "Invisible container",
  "layout": { "title": null },
  "properties": {
    "section": {
      "type": "object",
      "title": "Section",
      "layout": { "subtitle": "This section has a subtitle." },
      "properties": {
        "str1": { "type": "string", "title": "String 1" },
        "str2": { "type": "string", "title": "String 2" },
        "nestedSection": {
          "type": "object",
          "layout": { "title": "Nested section" },
          "properties": { "str3": { "type": "string" } }
        }
      }
    }
  }
}
```

Goal: navigate the nested structure, fill `str1`, `str2`, and `str3` inside the nested section.

#### 4.2 Tabs (`composite/tabs`)

```json
{
  "type": "object",
  "layout": "tabs",
  "title": "Tabs",
  "properties": {
    "tab1": { "type": "object", "title": "Tab 1", "properties": { "str1": { "type": "string" }, "str2": { "type": "string" } } },
    "tab2": { "type": "object", "title": "Tab 2", "properties": { "str3": { "type": "string" } } }
  }
}
```

Goal: fill fields across both tabs using `describeState` with paths.

#### 4.3 Expansion panels (`composite/expansion-panels`)

```json
{
  "type": "object",
  "layout": "expansion-panels",
  "title": "Expansion panels",
  "properties": {
    "panel1": { "type": "object", "title": "Panel 1", "properties": { "str1": { "type": "string" }, "str2": { "type": "string" } } },
    "panel2": { "type": "object", "title": "Panel 2", "properties": { "str3": { "type": "string" } } }
  }
}
```

Goal: same as tabs — fill fields in both panels.

---

### Level 5 — Conditional schemas

These are the hardest. The form structure changes based on data.

#### 5.1 oneOf (`combine/one-of`)

```json
{
  "type": "object",
  "title": "An object with a oneOf",
  "oneOfLayout": { "label": "Select a subschema" },
  "oneOf": [
    { "title": "oneOf 1", "required": ["str1"], "properties": { "key": { "const": "oneOf1" }, "str1": { "type": "string" } } },
    { "title": "oneOf 2", "required": ["str2"], "properties": { "key": { "const": "oneOf2" }, "str2": { "type": "string" } } }
  ]
}
```

Goal: select the first branch, fill `str1`. Then switch to the second branch, fill `str2`. Use `describeState` after each switch to see the new form structure.

#### 5.2 allOf (`combine/all-of`)

```json
{
  "type": "object",
  "title": "An object with a allOf",
  "allOf": [
    { "title": "allOf 1", "required": ["str1"], "properties": { "str1": { "type": "string" } } },
    { "title": "allOf 2", "required": ["str2"], "properties": { "str2": { "type": "string" } } }
  ]
}
```

Goal: both sections are visible simultaneously. Fill `str1` and `str2`.

#### 5.3 if/then/else (`combine/if-then-else`)

```json
{
  "type": "object",
  "title": "An object with if/then/else",
  "properties": {
    "str1": { "type": "string", "enum": ["type1", "type2", "type3"] }
  },
  "dependentSchemas": {
    "str1": {
      "if": { "properties": { "str1": { "const": "type1" } } },
      "then": { "properties": { "str2": { "type": "string" } } },
      "else": { "properties": { "str3": { "type": "string" } } }
    }
  }
}
```

Goal: set `str1` to `"type1"`, observe that `str2` appears. Then change `str1` to `"type2"`, observe that `str3` appears instead. Use `describeState` after each change.

#### 5.4 Dependent schemas (`combine/dependent-schemas`)

```json
{
  "type": "object",
  "title": "An object with a string that depends on another",
  "properties": {
    "str1": { "type": "string" }
  },
  "dependentSchemas": {
    "str1": {
      "properties": { "str2": { "type": "string" } }
    }
  }
}
```

Goal: fill `str1`, then observe that `str2` appears. Fill `str2`.

---

### Level 6 — Lists and arrays

#### 6.1 Comboboxes / chip lists (`lists/comboboxes`)

```json
{
  "type": "object",
  "properties": {
    "strArray1": { "type": "array", "title": "An array of strings", "items": { "type": "string" } },
    "nbArray1": { "type": "array", "title": "An array of numbers", "items": { "type": "number" } },
    "strSep1": { "type": "string", "title": "A string with values separated by a comma", "layout": { "separator": "," } }
  }
}
```

Goal: fill arrays with multiple values, fill the separated string.

#### 6.2 Editable lists (`lists/list`)

```json
{
  "type": "object",
  "properties": {
    "dateArray1": { "type": "array", "title": "An array of dates", "items": { "type": "string", "format": "date" } },
    "objArray1": { "type": "array", "title": "An array of objects", "items": { "type": "object", "properties": { "str1": { "type": "string" }, "str2": { "type": "string" } } } }
  }
}
```

Goal: add multiple items to each array using `setData`.

---

### Level 7 — Recursion

#### 7.1 Recursive objects (`combine/recursion`)

```json
{
  "type": "object",
  "required": ["recursiveObject1"],
  "properties": {
    "recursiveObject1": { "$ref": "#/$defs/recursiveObject1" }
  },
  "$defs": {
    "recursiveObject1": {
      "type": "object",
      "required": ["key"],
      "properties": {
        "key": { "type": "string", "pattern": "^[A-Z]+$" },
        "children": {
          "type": "array",
          "layout": { "if": "parent.data?.key?.length > 0" },
          "items": { "$ref": "#/$defs/recursiveObject1" }
        }
      }
    }
  }
}
```

Goal: create a tree structure with at least 2 levels of recursion. Each `key` must be uppercase.

---

## Reporting

After completing (or attempting) all levels, provide a summary:

1. **Success rate**: how many examples were filled successfully?
2. **Tool ergonomics**: which tools were intuitive? Which were confusing?
3. **Projection quality**: was the state tree output from `describeState` sufficient to understand the form? What was missing?
4. **Error handling**: were validation errors clear enough to fix?
5. **Suggestions**: what would make the toolkit easier to use?

Focus especially on:
- Cases where you had to guess schema constraints that weren't visible in the projected state
- Cases where the path format was unclear
- Cases where you didn't know which tool to use
- Cases where `getFieldSuggestions` didn't return expected results
