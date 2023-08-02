/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "comp-object".
 */
export type CompObject = None | Section | TextField | NumberField | Textarea | Checkbox;

export interface NormalizedLayout {
  read: NormalizedResponsive;
  write: NormalizedResponsive;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "normalized-responsive".
 */
export interface NormalizedResponsive {
  xs: CompObject;
  sm: CompObject;
  md: CompObject;
  lg: CompObject;
  xl: CompObject;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "none".
 */
export interface None {
  comp: "none";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "section".
 */
export interface Section {
  comp: "section";
  title?: string;
  children?: string[];
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "text-field".
 */
export interface TextField {
  comp: "text-field";
  label: string;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "number-field".
 */
export interface NumberField {
  comp: "number-field";
  label: string;
  step?: number;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "textarea".
 */
export interface Textarea {
  comp: "textarea";
  label: string;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "checkbox".
 */
export interface Checkbox {
  comp: "checkbox";
  label: string;
}

// raw schema
export const normalizedLayoutKeywordSchema = {
  "$id": "https://json-layout.github.io/normalized-layout-keyword",
  "title": "normalized layout",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "read",
    "write"
  ],
  "properties": {
    "read": {
      "$ref": "#/$defs/normalized-responsive"
    },
    "write": {
      "$ref": "#/$defs/normalized-responsive"
    }
  },
  "$defs": {
    "normalized-responsive": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "xs",
        "sm",
        "md",
        "lg",
        "xl"
      ],
      "properties": {
        "xs": {
          "$ref": "#/$defs/comp-object"
        },
        "sm": {
          "$ref": "#/$defs/comp-object"
        },
        "md": {
          "$ref": "#/$defs/comp-object"
        },
        "lg": {
          "$ref": "#/$defs/comp-object"
        },
        "xl": {
          "$ref": "#/$defs/comp-object"
        }
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
        "label": {
          "type": "string"
        }
      }
    }
  }
}
