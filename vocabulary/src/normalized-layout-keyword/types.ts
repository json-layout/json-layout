export type NormalizedLayout = SwitchStruct | CompObject;
export type CompObject = {
  if?: Expression;
  help?: string;
  cols?: ColsObj;
  props?: StateNodePropsLib;
  slots?: StateNodeSlotsLib & {
    before?: Slot;
    after?: Slot;
    component?: Slot;
    [k: string]: unknown;
  };
  options?: StateNodeOptions;
  [k: string]: unknown;
} & (
  | None
  | List
  | TextField
  | NumberField
  | Textarea
  | Checkbox
  | Switch
  | Slider
  | DatePicker
  | DateTimePicker
  | TimePicker
  | ColorPicker
  | Select
  | OneOfSelect
  | Section
  | Tabs
  | VerticalTabs
  | ExpansionPanels
);
export type Cols = number;
/**
 * This interface was referenced by `StateNodeSlotsLib`'s JSON-Schema definition
 * via the `patternProperty` ".*".
 */
export type Slot =
  | {
      text?: string;
    }
  | {
      markdown?: string;
    }
  | {
      name?: string;
    };
export type StateNodeOptions = StateNodeOptionsLib & {
  readOnly?: boolean;
  summary?: boolean;
  titleDepth?: number;
  [k: string]: unknown;
};
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
export type Child = Child1 & {
  key: string | number;
  cols?: ColsObj;
  [k: string]: unknown;
};
export type Child1 = unknown | CompositeCompObject;
export type CompositeCompObject = Section | Tabs | VerticalTabs | ExpansionPanels;
export type Children = Child[];

export interface SwitchStruct {
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
export interface StateNodePropsLib {
  /**
   * This interface was referenced by `StateNodePropsLib`'s JSON-Schema definition
   * via the `patternProperty` ".*".
   */
  [k: string]: unknown;
}
export interface StateNodeSlotsLib {
  [k: string]: Slot;
}
export interface StateNodeOptionsLib {
  /**
   * This interface was referenced by `StateNodeOptionsLib`'s JSON-Schema definition
   * via the `patternProperty` ".*".
   */
  [k: string]: unknown;
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
  min?: number;
  max?: number;
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
export interface Switch {
  comp: "switch";
  label: string;
  [k: string]: unknown;
}
export interface Slider {
  comp: "slider";
  label: string;
  step?: number;
  min: number;
  max: number;
  [k: string]: unknown;
}
export interface DatePicker {
  comp: "date-picker";
  label: string;
  min?: string;
  max?: string;
  [k: string]: unknown;
}
export interface DateTimePicker {
  comp: "date-time-picker";
  label: string;
  min?: string;
  max?: string;
  [k: string]: unknown;
}
export interface TimePicker {
  comp: "time-picker";
  label: string;
  min?: string;
  max?: string;
  [k: string]: unknown;
}
export interface ColorPicker {
  comp: "color-picker";
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
export interface Tabs {
  comp: "tabs";
  title?: string | null;
  children: Children;
  [k: string]: unknown;
}
export interface VerticalTabs {
  comp: "vertical-tabs";
  title?: string | null;
  children: Children;
  [k: string]: unknown;
}
export interface ExpansionPanels {
  comp: "expansion-panels";
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
      "$ref": "#/$defs/switch-struct"
    },
    {
      "$ref": "#/$defs/comp-object"
    }
  ],
  "$defs": {
    "switch-struct": {
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
            },
            "props": {
              "$ref": "#/$defs/state-node-props-lib"
            },
            "slots": {
              "type": "object",
              "allOf": [
                {
                  "$ref": "#/$defs/state-node-slots-lib"
                },
                {
                  "properties": {
                    "before": {
                      "$ref": "#/$defs/slot"
                    },
                    "after": {
                      "$ref": "#/$defs/slot"
                    },
                    "component": {
                      "$ref": "#/$defs/slot"
                    }
                  }
                }
              ]
            },
            "options": {
              "$ref": "#/$defs/state-node-options"
            }
          }
        },
        {
          "discriminator": {
            "propertyName": "comp"
          },
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
              "$ref": "#/$defs/switch"
            },
            {
              "$ref": "#/$defs/slider"
            },
            {
              "$ref": "#/$defs/date-picker"
            },
            {
              "$ref": "#/$defs/date-time-picker"
            },
            {
              "$ref": "#/$defs/time-picker"
            },
            {
              "$ref": "#/$defs/color-picker"
            },
            {
              "$ref": "#/$defs/select"
            },
            {
              "$ref": "#/$defs/one-of-select"
            },
            {
              "$ref": "#/$defs/section"
            },
            {
              "$ref": "#/$defs/tabs"
            },
            {
              "$ref": "#/$defs/vertical-tabs"
            },
            {
              "$ref": "#/$defs/expansion-panels"
            }
          ]
        }
      ]
    },
    "composite-comp-object": {
      "type": "object",
      "discriminator": {
        "propertyName": "comp"
      },
      "oneOf": [
        {
          "$ref": "#/$defs/section"
        },
        {
          "$ref": "#/$defs/tabs"
        },
        {
          "$ref": "#/$defs/vertical-tabs"
        },
        {
          "$ref": "#/$defs/expansion-panels"
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
    "tabs": {
      "type": "object",
      "required": [
        "comp",
        "children"
      ],
      "properties": {
        "comp": {
          "const": "tabs"
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
    "vertical-tabs": {
      "type": "object",
      "required": [
        "comp",
        "children"
      ],
      "properties": {
        "comp": {
          "const": "vertical-tabs"
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
    "expansion-panels": {
      "type": "object",
      "required": [
        "comp",
        "children"
      ],
      "properties": {
        "comp": {
          "const": "expansion-panels"
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
        },
        "min": {
          "type": "number"
        },
        "max": {
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
    "switch": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "switch"
        },
        "label": {
          "type": "string"
        }
      }
    },
    "slider": {
      "type": "object",
      "required": [
        "comp",
        "label",
        "min",
        "max"
      ],
      "properties": {
        "comp": {
          "const": "slider"
        },
        "label": {
          "type": "string"
        },
        "step": {
          "type": "number"
        },
        "min": {
          "type": "number"
        },
        "max": {
          "type": "number"
        }
      }
    },
    "date-picker": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "date-picker"
        },
        "label": {
          "type": "string"
        },
        "min": {
          "type": "string",
          "format": "date"
        },
        "max": {
          "type": "string",
          "format": "date"
        }
      }
    },
    "date-time-picker": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "date-time-picker"
        },
        "label": {
          "type": "string"
        },
        "min": {
          "type": "string",
          "format": "date-time"
        },
        "max": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "time-picker": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "time-picker"
        },
        "label": {
          "type": "string"
        },
        "min": {
          "type": "string",
          "format": "time"
        },
        "max": {
          "type": "string",
          "format": "time"
        }
      }
    },
    "color-picker": {
      "type": "object",
      "required": [
        "comp",
        "label"
      ],
      "properties": {
        "comp": {
          "const": "color-picker"
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
    },
    "slot": {
      "oneOf": [
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "text": {
              "type": "string"
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "markdown": {
              "type": "string"
            }
          }
        },
        {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "name": {
              "type": "string"
            }
          }
        }
      ]
    },
    "state-node-options": {
      "type": "object",
      "allOf": [
        {
          "$ref": "#/$defs/state-node-options-lib"
        },
        {
          "properties": {
            "readOnly": {
              "type": "boolean",
              "default": false
            },
            "summary": {
              "type": "boolean",
              "default": false
            },
            "titleDepth": {
              "type": "integer",
              "minimum": 1,
              "maximum": 6,
              "default": 2
            }
          }
        }
      ]
    },
    "state-node-options-lib": {
      "type": "object",
      "patternProperties": {
        ".*": {}
      }
    },
    "state-node-props-lib": {
      "type": "object",
      "patternProperties": {
        ".*": {}
      }
    },
    "state-node-slots-lib": {
      "type": "object",
      "patternProperties": {
        ".*": {
          "$ref": "#/$defs/slot"
        }
      }
    }
  }
}
