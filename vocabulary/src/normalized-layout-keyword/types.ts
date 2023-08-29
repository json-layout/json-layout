export type NormalizedLayout = Switch | CompObject;
export type CompObject =
  | None
  | List
  | TextField
  | NumberField
  | Textarea
  | Checkbox
  | Select
  | OneOfSelect
  | CompositeCompObject;
export type SelectItems = SelectItem[];
export type GetItems = {
  returnObjects?: boolean;
  itemsResults?: Expression;
  itemTitle?: Expression;
  itemKey?: Expression;
  itemValue?: Expression;
  [k: string]: unknown;
} & GetItems1;
export type GetItems1 = Expression | GetItemsFetch;
export type CompositeCompObject = Section;
export type Child = Child1 & {
  key: string | number;
  width?: number;
  [k: string]: unknown;
};
export type Child1 = unknown | CompositeCompObject;
export type Children = Child[];

export interface Switch {
  switch: CompObject[];
}
export interface None {
  comp: "none";
  if?: Expression;
  [k: string]: unknown;
}
export interface Expression {
  type: "expr-eval" | "js-fn" | "js-eval" | "js-tpl";
  expr: string;
  ref?: number;
  [k: string]: unknown;
}
export interface List {
  comp: "list";
  if?: Expression;
  title?: string;
  help?: string;
  [k: string]: unknown;
}
export interface TextField {
  comp: "text-field";
  if?: Expression;
  label: string;
  help?: string;
  [k: string]: unknown;
}
export interface NumberField {
  comp: "number-field";
  if?: Expression;
  label: string;
  step?: number;
  help?: string;
  [k: string]: unknown;
}
export interface Textarea {
  comp: "textarea";
  if?: Expression;
  label: string;
  help?: string;
  [k: string]: unknown;
}
export interface Checkbox {
  comp: "checkbox";
  if?: Expression;
  label: string;
  help?: string;
  [k: string]: unknown;
}
export interface Select {
  comp: "select";
  if?: Expression;
  label: string;
  items?: SelectItems;
  getItems?: GetItems;
  help?: string;
  [k: string]: unknown;
}
export interface SelectItem {
  title: string;
  key: string;
  value: unknown;
  [k: string]: unknown;
}
export interface GetItemsFetch {
  url: Expression;
  [k: string]: unknown;
}
export interface OneOfSelect {
  comp: "one-of-select";
  if?: Expression;
  label?: string;
  help?: string;
  [k: string]: unknown;
}
export interface Section {
  comp: "section";
  if?: Expression;
  title?: string | null;
  children: Children;
  help?: string;
  [k: string]: unknown;
}

// raw schema
export const normalizedLayoutKeywordSchema = {
  "$id": "https://json-layout.github.io/normalized-layout-keyword",
  "title": "normalized layout",
  "oneOf": [
    {
      "$ref": "#/$defs/switch"
    },
    {
      "$ref": "#/$defs/comp-object"
    }
  ],
  "$defs": {
    "switch": {
      "type": "object",
      "required": [
        "switch"
      ],
      "additionalProperties": false,
      "properties": {
        "switch": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/comp-object"
          }
        }
      }
    },
    "comp-object": {
      "type": "object",
      "required": [
        "comp"
      ],
      "unevaluatedProperties": false,
      "oneOf": [
        {
          "$ref": "#/$defs/none"
        },
        {
          "$ref": "#/$defs/list"
        },
        {
          "$ref": "#/$defs/text-field"
        },
        {
          "$ref": "#/$defs/number-field"
        },
        {
          "$ref": "#/$defs/textarea"
        },
        {
          "$ref": "#/$defs/checkbox"
        },
        {
          "$ref": "#/$defs/select"
        },
        {
          "$ref": "#/$defs/one-of-select"
        },
        {
          "$ref": "#/$defs/composite-comp-object"
        }
      ]
    },
    "composite-comp-object": {
      "type": "object",
      "oneOf": [
        {
          "$ref": "#/$defs/section"
        }
      ]
    },
    "none": {
      "type": "object",
      "required": [
        "comp"
      ],
      "properties": {
        "comp": {
          "const": "none"
        },
        "if": {
          "$ref": "#/$defs/expression"
        }
      }
    },
    "section": {
      "type": "object",
      "required": [
        "comp",
        "children"
      ],
      "properties": {
        "comp": {
          "const": "section"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "title": {
          "type": [
            "string",
            "null"
          ]
        },
        "children": {
          "$ref": "#/$defs/children"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "child": {
      "type": "object",
      "unevaluatedProperties": false,
      "required": [
        "key"
      ],
      "properties": {
        "key": {
          "type": [
            "string",
            "integer"
          ]
        },
        "width": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      },
      "anyOf": [
        {},
        {
          "$ref": "#/$defs/composite-comp-object"
        }
      ]
    },
    "children": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/child"
      }
    },
    "list": {
      "type": "object",
      "required": [
        "comp"
      ],
      "properties": {
        "comp": {
          "const": "list"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "title": {
          "type": "string"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "text-field": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "text-field"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "number-field": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "number-field"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "step": {
          "type": "number"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "textarea": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "textarea"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "checkbox": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "checkbox"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "select": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "select"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "items": {
          "$ref": "#/$defs/select-items"
        },
        "getItems": {
          "$ref": "#/$defs/get-items"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "select-items": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/select-item"
      }
    },
    "select-item": {
      "type": "object",
      "required": [
        "title",
        "key",
        "value"
      ],
      "properties": {
        "title": {
          "type": "string"
        },
        "key": {
          "type": "string"
        },
        "value": {}
      }
    },
    "get-items": {
      "type": "object",
      "properties": {
        "returnObjects": {
          "type": "boolean",
          "readOnly": true
        },
        "itemsResults": {
          "$ref": "#/$defs/expression"
        },
        "itemTitle": {
          "$ref": "#/$defs/expression"
        },
        "itemKey": {
          "$ref": "#/$defs/expression"
        },
        "itemValue": {
          "$ref": "#/$defs/expression"
        }
      },
      "oneOf": [
        {
          "$ref": "#/$defs/expression"
        },
        {
          "$ref": "#/$defs/get-items-fetch"
        }
      ]
    },
    "get-items-fetch": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "$ref": "#/$defs/expression"
        }
      }
    },
    "one-of-select": {
      "type": "object",
      "required": [
        "comp"
      ],
      "properties": {
        "comp": {
          "const": "one-of-select"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "label": {
          "type": "string"
        },
        "help": {
          "type": "string"
        }
      }
    },
    "expression": {
      "type": "object",
      "required": [
        "type",
        "expr"
      ],
      "properties": {
        "type": {
          "type": "string",
          "enum": [
            "expr-eval",
            "js-fn",
            "js-eval",
            "js-tpl"
          ]
        },
        "expr": {
          "type": "string"
        },
        "ref": {
          "type": "integer",
          "readOnly": true
        }
      }
    }
  }
}
