export type LayoutKeyword = ComponentName | Children | PartialCompObject | Responsive | ReadWrite;
export type ComponentName = "text-field" | "number-field" | "textarea" | "checkbox";
export type Children = string[];
export type Responsive = Responsive1 & {
  /**
   * < 600px
   */
  xs?: ComponentName | Children | PartialCompObject;
  /**
   * >= 600px, < 960
   */
  sm?: ComponentName | Children | PartialCompObject;
  /**
   * >= 960px, < 1264
   */
  md?: ComponentName | Children | PartialCompObject;
  /**
   * >= 1264px, < 1904
   */
  lg?: ComponentName | Children | PartialCompObject;
  /**
   * >= 1904
   */
  xl?: ComponentName | Children | PartialCompObject;
};
export type Responsive1 = {
  [k: string]: unknown;
};
export type ReadWrite = ReadWrite1 & {
  /**
   * apply this layout if data is rendered read only
   */
  read?: ComponentName | Children | PartialCompObject | Responsive1;
  /**
   * apply this layout if data is rendered for writes
   */
  write?: ComponentName | Children | PartialCompObject | Responsive1;
};
export type ReadWrite1 = {
  [k: string]: unknown;
};

export interface PartialCompObject {
  comp?: ComponentName;
  children?: Children;
  label?: string;
  title?: string;
  step?: number;
}

// raw schema
export const layoutKeywordSchema = {
  "$id": "https://json-layout.github.io/layout-keyword",
  "title": "layout keyword",
  "oneOf": [
    {
      "$ref": "#/$defs/comp"
    },
    {
      "$ref": "#/$defs/children"
    },
    {
      "$ref": "#/$defs/partial"
    },
    {
      "$ref": "#/$defs/responsive"
    },
    {
      "$ref": "#/$defs/read-write"
    }
  ],
  "$defs": {
    "comp": {
      "title": "component name",
      "type": "string",
      "enum": [
        "text-field",
        "number-field",
        "textarea",
        "checkbox"
      ]
    },
    "children": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "partial": {
      "title": "partial comp object",
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "comp": {
          "$ref": "#/$defs/comp"
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
        }
      }
    },
    "responsive": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "xs": {
          "description": "< 600px",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            }
          ]
        },
        "sm": {
          "description": ">= 600px, < 960",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            }
          ]
        },
        "md": {
          "description": ">= 960px, < 1264",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            }
          ]
        },
        "lg": {
          "description": ">= 1264px, < 1904",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            }
          ]
        },
        "xl": {
          "description": ">= 1904",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            }
          ]
        }
      },
      "anyOf": [
        {
          "required": [
            "xs"
          ]
        },
        {
          "required": [
            "sm"
          ]
        },
        {
          "required": [
            "md"
          ]
        },
        {
          "required": [
            "lg"
          ]
        },
        {
          "required": [
            "xl"
          ]
        }
      ]
    },
    "read-write": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "read": {
          "description": "apply this layout if data is rendered read only",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            },
            {
              "$ref": "#/$defs/responsive"
            }
          ]
        },
        "write": {
          "description": "apply this layout if data is rendered for writes",
          "oneOf": [
            {
              "$ref": "#/$defs/comp"
            },
            {
              "$ref": "#/$defs/children"
            },
            {
              "$ref": "#/$defs/partial"
            },
            {
              "$ref": "#/$defs/responsive"
            }
          ]
        }
      },
      "anyOf": [
        {
          "required": [
            "read"
          ]
        },
        {
          "required": [
            "write"
          ]
        }
      ]
    }
  }
}
