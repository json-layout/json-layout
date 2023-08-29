export type NormalizedLayout = Switch | CompObject;
export type CompObject = {
  if?: Expression;
  help?: string;
  cols?: ColsObj;
  [k: string]: unknown;
} & (None | List | TextField | NumberField | Textarea | Checkbox | Select | OneOfSelect | CompositeCompObject);
export type Cols = number;
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
  cols?: ColsObj;
  [k: string]: unknown;
};
export type Child1 = unknown | CompositeCompObject;
export type Children = Child[];

export interface Switch {
  switch: CompObject[];
}
export interface Expression {
  type: "expr-eval" | "js-fn" | "js-eval" | "js-tpl";
  expr: string;
  ref?: number;
  [k: string]: unknown;
}
export interface ColsObj {
  xs: number;
  sm?: Cols;
  md?: Cols;
  lg?: Cols;
  xl?: Cols;
  xxl?: Cols;
}
export interface None {
  comp: "none";
  [k: string]: unknown;
}
export interface List {
  comp: "list";
  title?: string;
  [k: string]: unknown;
}
export interface TextField {
  comp: "text-field";
  label: string;
  [k: string]: unknown;
}
export interface NumberField {
  comp: "number-field";
  label: string;
  step?: number;
  [k: string]: unknown;
}
export interface Textarea {
  comp: "textarea";
  label: string;
  [k: string]: unknown;
}
export interface Checkbox {
  comp: "checkbox";
  label: string;
  [k: string]: unknown;
}
export interface Select {
  comp: "select";
  label: string;
  items?: SelectItems;
  getItems?: GetItems;
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
  title?: string | null;
  children: Children;
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
      "allOf": [
        {
          "properties": {
            "if": {
              "$ref": "#/$defs/expression"
            },
            "help": {
              "type": "string"
            },
            "cols": {
              "$ref": "#/$defs/cols-obj"
            }
          }
        },
        {
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
        "title": {
          "type": [
            "string",
            "null"
          ]
        },
        "children": {
          "$ref": "#/$defs/children"
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
        "cols": {
          "$ref": "#/$defs/cols-obj"
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
        "title": {
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
        "label": {
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
        "label": {
          "type": "string"
        },
        "step": {
          "type": "number"
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
        "label": {
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
        "label": {
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
        "label": {
          "type": "string"
        },
        "items": {
          "$ref": "#/$defs/select-items"
        },
        "getItems": {
          "$ref": "#/$defs/get-items"
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
    },
    "cols-obj": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "xs"
      ],
      "properties": {
        "xs": {
          "$ref": "#/$defs/cols",
          "default": 12
        },
        "sm": {
          "$ref": "#/$defs/cols"
        },
        "md": {
          "$ref": "#/$defs/cols"
        },
        "lg": {
          "$ref": "#/$defs/cols"
        },
        "xl": {
          "$ref": "#/$defs/cols"
        },
        "xxl": {
          "$ref": "#/$defs/cols"
        }
      }
    },
    "cols": {
      "type": "integer",
      "minimum": 0,
      "maximum": 12
    }
  }
}
