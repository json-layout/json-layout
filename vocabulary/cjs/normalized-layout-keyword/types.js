"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizedLayoutKeywordSchema = void 0;
// raw schema
exports.normalizedLayoutKeywordSchema = {
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
                    "$ref": "#/$defs/section"
                },
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
        "section": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
                "comp": {
                    "const": "section"
                }
            }
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
};
