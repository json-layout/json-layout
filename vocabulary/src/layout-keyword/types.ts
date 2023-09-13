export type LayoutKeyword = ComponentName | PartialChildren | PartialCompObject | PartialSwitch;
export type ComponentName =
  | "none"
  | "text-field"
  | "number-field"
  | "textarea"
  | "checkbox"
  | "switch"
  | "section"
  | "list"
  | "select"
  | "tabs"
  | "vertical-tabs"
  | "expansion-panels";
export type PartialChild = PartialChild1 & {
  key?: string | number;
  cols?: PartialCols;
  [k: string]: unknown;
};
export type PartialChild1 = PartialCompObject & unknown;
export type PartialExpression = string | PartialExpressionObj;
export type PartialSelectItem =
  | string
  | {
      key?: string;
      title?: string;
      value?: unknown;
      [k: string]: unknown;
    };
export type PartialGetItems = string | PartialGetItemsObj;
export type PartialGetItemsObj = {
  itemTitle?: PartialExpression;
  itemKey?: PartialExpression;
  itemValue?: PartialExpression;
  itemsResults?: PartialExpression;
  [k: string]: unknown;
} & PartialGetItemsObj1;
export type PartialGetItemsObj1 = PartialExpression | PartialGetItemsFetch;
export type PartialCols = PartialColsNumber | PartialColsObj;
export type PartialColsNumber = number;
/**
 * This interface was referenced by `undefined`'s JSON-Schema definition
 * via the `patternProperty` ".*".
 */
export type PartialSlot = string | PartialSlotText | PartialSlotMarkdown | PartialSlotName;
export type PartialChildren = (string | PartialChild)[];

export interface PartialCompObject {
  comp?: ComponentName;
  help?: string;
  children?: PartialChildren;
  label?: string;
  title?: string | null;
  step?: number;
  if?: PartialExpression;
  items?: PartialSelectItem[];
  getItems?: PartialGetItems;
  cols?: PartialCols;
  props?: {
    [k: string]: unknown;
  };
  slots?: {
    [k: string]: PartialSlot;
  };
  options?: {
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface PartialExpressionObj {
  type?: "expr-eval" | "js-fn" | "js-eval" | "js-tpl";
  expr: string;
  [k: string]: unknown;
}
export interface PartialGetItemsFetch {
  url: PartialExpression;
  [k: string]: unknown;
}
export interface PartialColsObj {
  xs?: PartialColsNumber;
  sm?: PartialColsNumber;
  md?: PartialColsNumber;
  lg?: PartialColsNumber;
  xl?: PartialColsNumber;
  xxl?: PartialColsNumber;
}
export interface PartialSlotText {
  text: string;
}
export interface PartialSlotMarkdown {
  markdown: string;
}
export interface PartialSlotName {
  name: string;
}
export interface PartialSwitch {
  switch: PartialCompObject[];
}

// raw schema
export const layoutKeywordSchema = {
  "$id": "https://json-layout.github.io/layout-keyword",
  "title": "layout keyword",
  "unevaluatedProperties": false,
  "anyOf": [
    {
      "$ref": "#/$defs/comp-name"
    },
    {
      "$ref": "#/$defs/partial-children"
    },
    {
      "$ref": "#/$defs/partial-comp-object"
    },
    {
      "$ref": "#/$defs/partial-switch"
    }
  ],
  "$defs": {
    "partial-switch": {
      "type": "object",
      "required": [
        "switch"
      ],
      "additionalProperties": false,
      "properties": {
        "switch": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/partial-comp-object"
          }
        }
      }
    },
    "partial-comp-object": {
      "title": "partial comp object",
      "type": "object",
      "properties": {
        "comp": {
          "$ref": "#/$defs/comp-name"
        },
        "help": {
          "type": "string"
        },
        "children": {
          "$ref": "#/$defs/partial-children"
        },
        "label": {
          "type": "string"
        },
        "title": {
          "type": [
            "string",
            "null"
          ]
        },
        "step": {
          "type": "number"
        },
        "if": {
          "$ref": "#/$defs/partial-expression"
        },
        "items": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/partial-select-item"
          }
        },
        "getItems": {
          "$ref": "#/$defs/partial-get-items"
        },
        "cols": {
          "$ref": "#/$defs/partial-cols"
        },
        "props": {
          "type": "object"
        },
        "slots": {
          "type": "object",
          "patternProperties": {
            ".*": {
              "$ref": "#/$defs/partial-slot"
            }
          }
        },
        "options": {
          "type": "object"
        }
      }
    },
    "comp-name": {
      "title": "component name",
      "type": "string",
      "enum": [
        "none",
        "text-field",
        "number-field",
        "textarea",
        "checkbox",
        "switch",
        "section",
        "list",
        "select",
        "tabs",
        "vertical-tabs",
        "expansion-panels"
      ]
    },
    "partial-child": {
      "type": "object",
      "unevaluatedProperties": false,
      "properties": {
        "key": {
          "type": [
            "string",
            "integer"
          ]
        },
        "cols": {
          "$ref": "#/$defs/partial-cols"
        }
      },
      "allOf": [
        {
          "$ref": "#/$defs/partial-comp-object"
        },
        {}
      ]
    },
    "partial-children": {
      "type": "array",
      "items": {
        "oneOf": [
          {
            "type": "string"
          },
          {
            "$ref": "#/$defs/partial-child"
          }
        ]
      }
    },
    "partial-expression": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/partial-expression-obj"
        }
      ]
    },
    "partial-expression-obj": {
      "type": "object",
      "required": [
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
        }
      }
    },
    "partial-select-item": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "object",
          "properties": {
            "key": {
              "type": "string"
            },
            "title": {
              "type": "string"
            },
            "value": {}
          }
        }
      ]
    },
    "partial-get-items": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/partial-get-items-obj"
        }
      ]
    },
    "partial-get-items-obj": {
      "type": "object",
      "properties": {
        "itemTitle": {
          "$ref": "#/$defs/partial-expression"
        },
        "itemKey": {
          "$ref": "#/$defs/partial-expression"
        },
        "itemValue": {
          "$ref": "#/$defs/partial-expression"
        },
        "itemsResults": {
          "$ref": "#/$defs/partial-expression"
        }
      },
      "oneOf": [
        {
          "$ref": "#/$defs/partial-expression"
        },
        {
          "$ref": "#/$defs/partial-get-items-fetch"
        }
      ]
    },
    "partial-get-items-fetch": {
      "type": "object",
      "required": [
        "url"
      ],
      "properties": {
        "url": {
          "$ref": "#/$defs/partial-expression"
        }
      }
    },
    "partial-cols": {
      "oneOf": [
        {
          "$ref": "#/$defs/partial-cols-number"
        },
        {
          "$ref": "#/$defs/partial-cols-obj"
        }
      ]
    },
    "partial-cols-obj": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "xs": {
          "$ref": "#/$defs/partial-cols-number"
        },
        "sm": {
          "$ref": "#/$defs/partial-cols-number"
        },
        "md": {
          "$ref": "#/$defs/partial-cols-number"
        },
        "lg": {
          "$ref": "#/$defs/partial-cols-number"
        },
        "xl": {
          "$ref": "#/$defs/partial-cols-number"
        },
        "xxl": {
          "$ref": "#/$defs/partial-cols-number"
        }
      }
    },
    "partial-cols-number": {
      "type": "integer",
      "minimum": 0,
      "maximum": 12
    },
    "partial-slot": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "$ref": "#/$defs/partial-slot-text"
        },
        {
          "$ref": "#/$defs/partial-slot-markdown"
        },
        {
          "$ref": "#/$defs/partial-slot-name"
        }
      ]
    },
    "partial-slot-text": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "text"
      ],
      "properties": {
        "text": {
          "type": "string"
        }
      }
    },
    "partial-slot-markdown": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "markdown"
      ],
      "properties": {
        "markdown": {
          "type": "string"
        }
      }
    },
    "partial-slot-name": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "name"
      ],
      "properties": {
        "name": {
          "type": "string"
        }
      }
    }
  }
}
