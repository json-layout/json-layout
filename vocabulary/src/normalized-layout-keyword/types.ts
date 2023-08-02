export type NormalizedLayout = Switch | CompObject;
export type CompObject = None | Section | TextField | NumberField | Textarea | Checkbox;
export type Switch = CompObject[];

export interface None {
  comp: "none";
  if?: Expression;
}
export interface Expression {
  type: "expr-eval" | "js-fn";
  expr: string;
  [k: string]: unknown;
}
export interface Section {
  comp: "section";
  if?: Expression;
  title?: string;
  children?: string[];
}
export interface TextField {
  comp: "text-field";
  if?: Expression;
  label: string;
}
export interface NumberField {
  comp: "number-field";
  if?: Expression;
  label: string;
  step?: number;
}
export interface Textarea {
  comp: "textarea";
  if?: Expression;
  label: string;
}
export interface Checkbox {
  comp: "checkbox";
  if?: Expression;
  label: string;
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
      "type": "array",
      "items": {
        "$ref": "#/$defs/comp-object"
      }
    },
    "comp-object": {
      "type": "object",
      "discriminator": {
        "propertyName": "comp"
      },
      "required": [
        "comp"
      ],
      "oneOf": [
        {
          "$ref": "#/$defs/none"
        },
        {
          "$ref": "#/$defs/section"
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
        }
      ]
    },
    "none": {
      "type": "object",
      "additionalProperties": false,
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
      "additionalProperties": false,
      "required": [
        "comp"
      ],
      "properties": {
        "comp": {
          "const": "section"
        },
        "if": {
          "$ref": "#/$defs/expression"
        },
        "title": {
          "type": "string"
        },
        "children": {
          "type": "array",
          "items": {
            "type": "string"
          }
        }
      }
    },
    "text-field": {
      "type": "object",
      "additionalProperties": false,
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
        }
      }
    },
    "number-field": {
      "type": "object",
      "additionalProperties": false,
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
        }
      }
    },
    "textarea": {
      "type": "object",
      "additionalProperties": false,
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
        }
      }
    },
    "checkbox": {
      "type": "object",
      "additionalProperties": false,
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
            "js-fn"
          ],
          "default": "expr-eval"
        },
        "expr": {
          "type": "string"
        }
      }
    }
  }
}
