export type LayoutKeyword = ComponentName | PartialChildren | PartialCompObject | PartialSwitch;
export type ComponentName =
  | "none"
  | "text-field"
  | "number-field"
  | "textarea"
  | "checkbox"
  | "section"
  | "list"
  | "select";
export type PartialChild = PartialCompObject & {
  key?: string | number;
  width?: number;
  [k: string]: unknown;
};
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
export type PartialChildren = (string | PartialChild)[];

export interface PartialCompObject {
  comp?: ComponentName;
  children?: PartialChildren;
  label?: string;
  title?: string;
  step?: number;
  if?: PartialExpression;
  items?: PartialSelectItem[];
  getItems?: PartialGetItems;
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
export interface PartialSwitch {
  switch: PartialCompObject[];
}

// raw schema
export const layoutKeywordSchema = {
  "$id": "https://json-layout.github.io/layout-keyword",
  "title": "layout keyword",
  "oneOf": [
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
      "additionalProperties": false,
      "properties": {
        "comp": {
          "$ref": "#/$defs/comp-name"
        },
        "children": {
          "$ref": "#/$defs/partial-children"
        },
        "label": {
          "type": "string"
        },
        "title": {
          "type": "string"
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
        "section",
        "list",
        "select"
      ]
    },
    "partial-child": {
      "type": "object",
      "unevaluatedProperties": false,
      "allOf": [
        {
          "$ref": "#/$defs/partial-comp-object"
        },
        {
          "properties": {
            "key": {
              "type": [
                "string",
                "integer"
              ]
            },
            "width": {
              "type": "number"
            }
          }
        }
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
    }
  }
}
