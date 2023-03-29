"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.layoutKeywordSchema = void 0;
// raw schema
exports.layoutKeywordSchema = {
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
};
