/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "comp-object".
 */
export type CompObject = TextField | Textarea | Checkbox;

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
 * via the `definition` "text-field".
 */
export interface TextField {
  comp?: "text-field";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "textarea".
 */
export interface Textarea {
  comp?: "textarea";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "checkbox".
 */
export interface Checkbox {
  comp?: "checkbox";
}

// raw schema
export const normalizedLayoutSchema = {
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
          "$ref": "#/$defs/text-field"
        },
        {
          "$ref": "#/$defs/textarea"
        },
        {
          "$ref": "#/$defs/checkbox"
        }
      ]
    },
    "text-field": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "comp": {
          "const": "text-field"
        }
      }
    },
    "textarea": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "comp": {
          "const": "textarea"
        }
      }
    },
    "checkbox": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "comp": {
          "const": "checkbox"
        }
      }
    }
  }
}
