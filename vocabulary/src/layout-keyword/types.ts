export type LayoutKeyword = ComponentName | Children | PartialCompObject | PartialSwitch;
export type ComponentName = "none" | "text-field" | "number-field" | "textarea" | "checkbox" | "list";
export type Children = string[];
export type PartialExpression =
  | string
  | {
      type?: "expr-eval" | "js-fn";
      expr: string;
      [k: string]: unknown;
    };
export type PartialSwitch = PartialCompObject[];

export interface PartialCompObject {
  comp?: ComponentName;
  children?: Children;
  label?: string;
  title?: string;
  step?: number;
  if?: PartialExpression;
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
      "$ref": "#/$defs/children"
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
      "type": "array",
      "items": {
        "$ref": "#/$defs/partial-comp-object"
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
          "$ref": "#/$defs/children"
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
        "list"
      ]
    },
    "children": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "partial-expression": {
      "oneOf": [
        {
          "type": "string"
        },
        {
          "type": "object",
          "required": [
            "expr"
          ],
          "properties": {
            "type": {
              "type": "string",
              "enum": [
                "expr-eval",
                "js-fn"
              ],
              "default": "expr-eval"
            },
            "expr": {
              "type": "string"
            }
          }
        }
      ]
    }
  }
}
