"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
exports.validate = validate26;
exports.default = validate26;
const schema33 = { "$id": "https://json-layout.github.io/normalized-layout-keyword", "title": "normalized layout", "type": "object", "additionalProperties": false, "required": ["read", "write"], "properties": { "read": { "$ref": "#/$defs/normalized-responsive" }, "write": { "$ref": "#/$defs/normalized-responsive" } }, "$defs": { "normalized-responsive": { "type": "object", "additionalProperties": false, "required": ["xs", "sm", "md", "lg", "xl"], "properties": { "xs": { "$ref": "#/$defs/comp-object" }, "sm": { "$ref": "#/$defs/comp-object" }, "md": { "$ref": "#/$defs/comp-object" }, "lg": { "$ref": "#/$defs/comp-object" }, "xl": { "$ref": "#/$defs/comp-object" } } }, "comp-object": { "type": "object", "discriminator": { "propertyName": "comp" }, "required": ["comp"], "oneOf": [{ "$ref": "#/$defs/section" }, { "$ref": "#/$defs/text-field" }, { "$ref": "#/$defs/textarea" }, { "$ref": "#/$defs/checkbox" }] }, "section": { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "section" } } }, "text-field": { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "text-field" } } }, "textarea": { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "textarea" } } }, "checkbox": { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "checkbox" } } } } };
const schema34 = { "type": "object", "additionalProperties": false, "required": ["xs", "sm", "md", "lg", "xl"], "properties": { "xs": { "$ref": "#/$defs/comp-object" }, "sm": { "$ref": "#/$defs/comp-object" }, "md": { "$ref": "#/$defs/comp-object" }, "lg": { "$ref": "#/$defs/comp-object" }, "xl": { "$ref": "#/$defs/comp-object" } } };
const schema35 = { "type": "object", "discriminator": { "propertyName": "comp" }, "required": ["comp"], "oneOf": [{ "$ref": "#/$defs/section" }, { "$ref": "#/$defs/text-field" }, { "$ref": "#/$defs/textarea" }, { "$ref": "#/$defs/checkbox" }] };
const schema36 = { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "section" } } };
const schema37 = { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "text-field" } } };
const schema38 = { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "textarea" } } };
const schema39 = { "type": "object", "additionalProperties": false, "properties": { "comp": { "const": "checkbox" } } };
function validate28(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { let vErrors = null; let errors = 0; if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if ((data.comp === undefined) && (missing0 = "comp")) {
            validate28.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const tag0 = data.comp;
            if (typeof tag0 == "string") {
                if (tag0 === "section") {
                    const _errs3 = errors;
                    if (errors === _errs3) {
                        if (data && typeof data == "object" && !Array.isArray(data)) {
                            const _errs5 = errors;
                            for (const key0 in data) {
                                if (!(key0 === "comp")) {
                                    validate28.errors = [{ instancePath, schemaPath: "#/$defs/section/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                }
                            }
                            if (_errs5 === errors) {
                                if (data.comp !== undefined) {
                                    if ("section" !== data.comp) {
                                        validate28.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/section/properties/comp/const", keyword: "const", params: { allowedValue: "section" }, message: "must be equal to constant" }];
                                        return false;
                                    }
                                }
                            }
                        }
                        else {
                            validate28.errors = [{ instancePath, schemaPath: "#/$defs/section/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                        }
                    }
                }
                else if (tag0 === "text-field") {
                    const _errs8 = errors;
                    if (errors === _errs8) {
                        if (data && typeof data == "object" && !Array.isArray(data)) {
                            const _errs10 = errors;
                            for (const key1 in data) {
                                if (!(key1 === "comp")) {
                                    validate28.errors = [{ instancePath, schemaPath: "#/$defs/text-field/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key1 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                }
                            }
                            if (_errs10 === errors) {
                                if (data.comp !== undefined) {
                                    if ("text-field" !== data.comp) {
                                        validate28.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/text-field/properties/comp/const", keyword: "const", params: { allowedValue: "text-field" }, message: "must be equal to constant" }];
                                        return false;
                                    }
                                }
                            }
                        }
                        else {
                            validate28.errors = [{ instancePath, schemaPath: "#/$defs/text-field/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                        }
                    }
                }
                else if (tag0 === "textarea") {
                    const _errs13 = errors;
                    if (errors === _errs13) {
                        if (data && typeof data == "object" && !Array.isArray(data)) {
                            const _errs15 = errors;
                            for (const key2 in data) {
                                if (!(key2 === "comp")) {
                                    validate28.errors = [{ instancePath, schemaPath: "#/$defs/textarea/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key2 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                }
                            }
                            if (_errs15 === errors) {
                                if (data.comp !== undefined) {
                                    if ("textarea" !== data.comp) {
                                        validate28.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/textarea/properties/comp/const", keyword: "const", params: { allowedValue: "textarea" }, message: "must be equal to constant" }];
                                        return false;
                                    }
                                }
                            }
                        }
                        else {
                            validate28.errors = [{ instancePath, schemaPath: "#/$defs/textarea/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                        }
                    }
                }
                else if (tag0 === "checkbox") {
                    const _errs18 = errors;
                    if (errors === _errs18) {
                        if (data && typeof data == "object" && !Array.isArray(data)) {
                            const _errs20 = errors;
                            for (const key3 in data) {
                                if (!(key3 === "comp")) {
                                    validate28.errors = [{ instancePath, schemaPath: "#/$defs/checkbox/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key3 }, message: "must NOT have additional properties" }];
                                    return false;
                                    break;
                                }
                            }
                            if (_errs20 === errors) {
                                if (data.comp !== undefined) {
                                    if ("checkbox" !== data.comp) {
                                        validate28.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/checkbox/properties/comp/const", keyword: "const", params: { allowedValue: "checkbox" }, message: "must be equal to constant" }];
                                        return false;
                                    }
                                }
                            }
                        }
                        else {
                            validate28.errors = [{ instancePath, schemaPath: "#/$defs/checkbox/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
                            return false;
                        }
                    }
                }
                else {
                    validate28.errors = [{ instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "mapping", tag: "comp", tagValue: tag0 }, message: "value of tag \"comp\" must be in oneOf" }];
                    return false;
                }
            }
            else {
                validate28.errors = [{ instancePath, schemaPath: "#/discriminator", keyword: "discriminator", params: { error: "tag", tag: "comp", tagValue: tag0 }, message: "tag \"comp\" must be string" }];
                return false;
            }
        }
    }
    else {
        validate28.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate28.errors = vErrors; return errors === 0; }
function validate27(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { let vErrors = null; let errors = 0; if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if ((((((data.xs === undefined) && (missing0 = "xs")) || ((data.sm === undefined) && (missing0 = "sm"))) || ((data.md === undefined) && (missing0 = "md"))) || ((data.lg === undefined) && (missing0 = "lg"))) || ((data.xl === undefined) && (missing0 = "xl"))) {
            validate27.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!(((((key0 === "xs") || (key0 === "sm")) || (key0 === "md")) || (key0 === "lg")) || (key0 === "xl"))) {
                    validate27.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.xs !== undefined) {
                    const _errs2 = errors;
                    if (!(validate28(data.xs, { instancePath: instancePath + "/xs", parentData: data, parentDataProperty: "xs", rootData }))) {
                        vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                        errors = vErrors.length;
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.sm !== undefined) {
                        const _errs3 = errors;
                        if (!(validate28(data.sm, { instancePath: instancePath + "/sm", parentData: data, parentDataProperty: "sm", rootData }))) {
                            vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                            errors = vErrors.length;
                        }
                        var valid0 = _errs3 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                    if (valid0) {
                        if (data.md !== undefined) {
                            const _errs4 = errors;
                            if (!(validate28(data.md, { instancePath: instancePath + "/md", parentData: data, parentDataProperty: "md", rootData }))) {
                                vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                                errors = vErrors.length;
                            }
                            var valid0 = _errs4 === errors;
                        }
                        else {
                            var valid0 = true;
                        }
                        if (valid0) {
                            if (data.lg !== undefined) {
                                const _errs5 = errors;
                                if (!(validate28(data.lg, { instancePath: instancePath + "/lg", parentData: data, parentDataProperty: "lg", rootData }))) {
                                    vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                                    errors = vErrors.length;
                                }
                                var valid0 = _errs5 === errors;
                            }
                            else {
                                var valid0 = true;
                            }
                            if (valid0) {
                                if (data.xl !== undefined) {
                                    const _errs6 = errors;
                                    if (!(validate28(data.xl, { instancePath: instancePath + "/xl", parentData: data, parentDataProperty: "xl", rootData }))) {
                                        vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);
                                        errors = vErrors.length;
                                    }
                                    var valid0 = _errs6 === errors;
                                }
                                else {
                                    var valid0 = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    else {
        validate27.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate27.errors = vErrors; return errors === 0; }
function validate26(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { /*# sourceURL="https://json-layout.github.io/normalized-layout-keyword" */ ; let vErrors = null; let errors = 0; if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing0;
        if (((data.read === undefined) && (missing0 = "read")) || ((data.write === undefined) && (missing0 = "write"))) {
            validate26.errors = [{ instancePath, schemaPath: "#/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" }];
            return false;
        }
        else {
            const _errs1 = errors;
            for (const key0 in data) {
                if (!((key0 === "read") || (key0 === "write"))) {
                    validate26.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                    return false;
                    break;
                }
            }
            if (_errs1 === errors) {
                if (data.read !== undefined) {
                    const _errs2 = errors;
                    if (!(validate27(data.read, { instancePath: instancePath + "/read", parentData: data, parentDataProperty: "read", rootData }))) {
                        vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                        errors = vErrors.length;
                    }
                    var valid0 = _errs2 === errors;
                }
                else {
                    var valid0 = true;
                }
                if (valid0) {
                    if (data.write !== undefined) {
                        const _errs3 = errors;
                        if (!(validate27(data.write, { instancePath: instancePath + "/write", parentData: data, parentDataProperty: "write", rootData }))) {
                            vErrors = vErrors === null ? validate27.errors : vErrors.concat(validate27.errors);
                            errors = vErrors.length;
                        }
                        var valid0 = _errs3 === errors;
                    }
                    else {
                        var valid0 = true;
                    }
                }
            }
        }
    }
    else {
        validate26.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate26.errors = vErrors; return errors === 0; }
