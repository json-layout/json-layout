"use strict";
export const validate = validate10;
export default validate10;
const schema11 = { "$id": "https://json-layout.github.io/layout-keyword", "title": "layout keyword", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }, { "$ref": "#/$defs/responsive" }, { "$ref": "#/$defs/read-write" }], "$defs": { "comp": { "title": "component name", "type": "string", "enum": ["text-field", "textarea", "checkbox"] }, "children": { "type": "array", "items": { "type": "string" } }, "partial": { "title": "partial comp object", "type": "object", "additionalProperties": false, "properties": { "comp": { "$ref": "#/$defs/comp" }, "children": { "$ref": "#/$defs/children" } } }, "responsive": { "type": "object", "additionalProperties": false, "properties": { "xs": { "description": "< 600px", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "sm": { "description": ">= 600px, < 960", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "md": { "description": ">= 960px, < 1264", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "lg": { "description": ">= 1264px, < 1904", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "xl": { "description": ">= 1904", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] } }, "anyOf": [{ "required": ["xs"] }, { "required": ["sm"] }, { "required": ["md"] }, { "required": ["lg"] }, { "required": ["xl"] }] }, "read-write": { "type": "object", "additionalProperties": false, "properties": { "read": { "description": "apply this layout if data is rendered read only", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }, { "$ref": "#/$defs/responsive" }] }, "write": { "description": "apply this layout if data is rendered for writes", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }, { "$ref": "#/$defs/responsive" }] } }, "anyOf": [{ "required": ["read"] }, { "required": ["write"] }] } } };
const schema12 = { "title": "component name", "type": "string", "enum": ["text-field", "textarea", "checkbox"] };
const schema13 = { "type": "array", "items": { "type": "string" } };
const schema14 = { "title": "partial comp object", "type": "object", "additionalProperties": false, "properties": { "comp": { "$ref": "#/$defs/comp" }, "children": { "$ref": "#/$defs/children" } } };
function validate11(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { let vErrors = null; let errors = 0; if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        const _errs1 = errors;
        for (const key0 in data) {
            if (!((key0 === "comp") || (key0 === "children"))) {
                validate11.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                return false;
                break;
            }
        }
        if (_errs1 === errors) {
            if (data.comp !== undefined) {
                let data0 = data.comp;
                const _errs2 = errors;
                if (typeof data0 !== "string") {
                    validate11.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                    return false;
                }
                if (!(((data0 === "text-field") || (data0 === "textarea")) || (data0 === "checkbox"))) {
                    validate11.errors = [{ instancePath: instancePath + "/comp", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" }];
                    return false;
                }
                var valid0 = _errs2 === errors;
            }
            else {
                var valid0 = true;
            }
            if (valid0) {
                if (data.children !== undefined) {
                    let data1 = data.children;
                    const _errs5 = errors;
                    const _errs6 = errors;
                    if (errors === _errs6) {
                        if (Array.isArray(data1)) {
                            var valid3 = true;
                            const len0 = data1.length;
                            for (let i0 = 0; i0 < len0; i0++) {
                                const _errs8 = errors;
                                if (typeof data1[i0] !== "string") {
                                    validate11.errors = [{ instancePath: instancePath + "/children/" + i0, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" }];
                                    return false;
                                }
                                var valid3 = _errs8 === errors;
                                if (!valid3) {
                                    break;
                                }
                            }
                        }
                        else {
                            validate11.errors = [{ instancePath: instancePath + "/children", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" }];
                            return false;
                        }
                    }
                    var valid0 = _errs5 === errors;
                }
                else {
                    var valid0 = true;
                }
            }
        }
    }
    else {
        validate11.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate11.errors = vErrors; return errors === 0; }
const schema17 = { "type": "object", "additionalProperties": false, "properties": { "xs": { "description": "< 600px", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "sm": { "description": ">= 600px, < 960", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "md": { "description": ">= 960px, < 1264", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "lg": { "description": ">= 1264px, < 1904", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] }, "xl": { "description": ">= 1904", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }] } }, "anyOf": [{ "required": ["xs"] }, { "required": ["sm"] }, { "required": ["md"] }, { "required": ["lg"] }, { "required": ["xl"] }] };
function validate13(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { let vErrors = null; let errors = 0; const _errs1 = errors; let valid0 = false; const _errs2 = errors; if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if ((data.xs === undefined) && (missing0 = "xs")) {
        const err0 = { instancePath, schemaPath: "#/anyOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
} var _valid0 = _errs2 === errors; valid0 = valid0 || _valid0; if (!valid0) {
    const _errs3 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing1;
        if ((data.sm === undefined) && (missing1 = "sm")) {
            const err1 = { instancePath, schemaPath: "#/anyOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
            if (vErrors === null) {
                vErrors = [err1];
            }
            else {
                vErrors.push(err1);
            }
            errors++;
        }
    }
    var _valid0 = _errs3 === errors;
    valid0 = valid0 || _valid0;
    if (!valid0) {
        const _errs4 = errors;
        if (data && typeof data == "object" && !Array.isArray(data)) {
            let missing2;
            if ((data.md === undefined) && (missing2 = "md")) {
                const err2 = { instancePath, schemaPath: "#/anyOf/2/required", keyword: "required", params: { missingProperty: missing2 }, message: "must have required property '" + missing2 + "'" };
                if (vErrors === null) {
                    vErrors = [err2];
                }
                else {
                    vErrors.push(err2);
                }
                errors++;
            }
        }
        var _valid0 = _errs4 === errors;
        valid0 = valid0 || _valid0;
        if (!valid0) {
            const _errs5 = errors;
            if (data && typeof data == "object" && !Array.isArray(data)) {
                let missing3;
                if ((data.lg === undefined) && (missing3 = "lg")) {
                    const err3 = { instancePath, schemaPath: "#/anyOf/3/required", keyword: "required", params: { missingProperty: missing3 }, message: "must have required property '" + missing3 + "'" };
                    if (vErrors === null) {
                        vErrors = [err3];
                    }
                    else {
                        vErrors.push(err3);
                    }
                    errors++;
                }
            }
            var _valid0 = _errs5 === errors;
            valid0 = valid0 || _valid0;
            if (!valid0) {
                const _errs6 = errors;
                if (data && typeof data == "object" && !Array.isArray(data)) {
                    let missing4;
                    if ((data.xl === undefined) && (missing4 = "xl")) {
                        const err4 = { instancePath, schemaPath: "#/anyOf/4/required", keyword: "required", params: { missingProperty: missing4 }, message: "must have required property '" + missing4 + "'" };
                        if (vErrors === null) {
                            vErrors = [err4];
                        }
                        else {
                            vErrors.push(err4);
                        }
                        errors++;
                    }
                }
                var _valid0 = _errs6 === errors;
                valid0 = valid0 || _valid0;
            }
        }
    }
} if (!valid0) {
    const err5 = { instancePath, schemaPath: "#/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
    if (vErrors === null) {
        vErrors = [err5];
    }
    else {
        vErrors.push(err5);
    }
    errors++;
    validate13.errors = vErrors;
    return false;
}
else {
    errors = _errs1;
    if (vErrors !== null) {
        if (_errs1) {
            vErrors.length = _errs1;
        }
        else {
            vErrors = null;
        }
    }
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        const _errs7 = errors;
        for (const key0 in data) {
            if (!(((((key0 === "xs") || (key0 === "sm")) || (key0 === "md")) || (key0 === "lg")) || (key0 === "xl"))) {
                validate13.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                return false;
                break;
            }
        }
        if (_errs7 === errors) {
            if (data.xs !== undefined) {
                let data0 = data.xs;
                const _errs8 = errors;
                const _errs9 = errors;
                let valid2 = false;
                let passing0 = null;
                const _errs10 = errors;
                if (typeof data0 !== "string") {
                    const err6 = { instancePath: instancePath + "/xs", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                        vErrors = [err6];
                    }
                    else {
                        vErrors.push(err6);
                    }
                    errors++;
                }
                if (!(((data0 === "text-field") || (data0 === "textarea")) || (data0 === "checkbox"))) {
                    const err7 = { instancePath: instancePath + "/xs", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                    if (vErrors === null) {
                        vErrors = [err7];
                    }
                    else {
                        vErrors.push(err7);
                    }
                    errors++;
                }
                var _valid1 = _errs10 === errors;
                if (_valid1) {
                    valid2 = true;
                    passing0 = 0;
                }
                const _errs13 = errors;
                const _errs14 = errors;
                if (errors === _errs14) {
                    if (Array.isArray(data0)) {
                        var valid5 = true;
                        const len0 = data0.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                            const _errs16 = errors;
                            if (typeof data0[i0] !== "string") {
                                const err8 = { instancePath: instancePath + "/xs/" + i0, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                    vErrors = [err8];
                                }
                                else {
                                    vErrors.push(err8);
                                }
                                errors++;
                            }
                            var valid5 = _errs16 === errors;
                            if (!valid5) {
                                break;
                            }
                        }
                    }
                    else {
                        const err9 = { instancePath: instancePath + "/xs", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                        if (vErrors === null) {
                            vErrors = [err9];
                        }
                        else {
                            vErrors.push(err9);
                        }
                        errors++;
                    }
                }
                var _valid1 = _errs13 === errors;
                if (_valid1 && valid2) {
                    valid2 = false;
                    passing0 = [passing0, 1];
                }
                else {
                    if (_valid1) {
                        valid2 = true;
                        passing0 = 1;
                    }
                    const _errs18 = errors;
                    if (!(validate11(data0, { instancePath: instancePath + "/xs", parentData: data, parentDataProperty: "xs", rootData }))) {
                        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                        errors = vErrors.length;
                    }
                    var _valid1 = _errs18 === errors;
                    if (_valid1 && valid2) {
                        valid2 = false;
                        passing0 = [passing0, 2];
                    }
                    else {
                        if (_valid1) {
                            valid2 = true;
                            passing0 = 2;
                        }
                    }
                }
                if (!valid2) {
                    const err10 = { instancePath: instancePath + "/xs", schemaPath: "#/properties/xs/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                        vErrors = [err10];
                    }
                    else {
                        vErrors.push(err10);
                    }
                    errors++;
                    validate13.errors = vErrors;
                    return false;
                }
                else {
                    errors = _errs9;
                    if (vErrors !== null) {
                        if (_errs9) {
                            vErrors.length = _errs9;
                        }
                        else {
                            vErrors = null;
                        }
                    }
                }
                var valid1 = _errs8 === errors;
            }
            else {
                var valid1 = true;
            }
            if (valid1) {
                if (data.sm !== undefined) {
                    let data2 = data.sm;
                    const _errs19 = errors;
                    const _errs20 = errors;
                    let valid6 = false;
                    let passing1 = null;
                    const _errs21 = errors;
                    if (typeof data2 !== "string") {
                        const err11 = { instancePath: instancePath + "/sm", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                            vErrors = [err11];
                        }
                        else {
                            vErrors.push(err11);
                        }
                        errors++;
                    }
                    if (!(((data2 === "text-field") || (data2 === "textarea")) || (data2 === "checkbox"))) {
                        const err12 = { instancePath: instancePath + "/sm", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                            vErrors = [err12];
                        }
                        else {
                            vErrors.push(err12);
                        }
                        errors++;
                    }
                    var _valid2 = _errs21 === errors;
                    if (_valid2) {
                        valid6 = true;
                        passing1 = 0;
                    }
                    const _errs24 = errors;
                    const _errs25 = errors;
                    if (errors === _errs25) {
                        if (Array.isArray(data2)) {
                            var valid9 = true;
                            const len1 = data2.length;
                            for (let i1 = 0; i1 < len1; i1++) {
                                const _errs27 = errors;
                                if (typeof data2[i1] !== "string") {
                                    const err13 = { instancePath: instancePath + "/sm/" + i1, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                        vErrors = [err13];
                                    }
                                    else {
                                        vErrors.push(err13);
                                    }
                                    errors++;
                                }
                                var valid9 = _errs27 === errors;
                                if (!valid9) {
                                    break;
                                }
                            }
                        }
                        else {
                            const err14 = { instancePath: instancePath + "/sm", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                            if (vErrors === null) {
                                vErrors = [err14];
                            }
                            else {
                                vErrors.push(err14);
                            }
                            errors++;
                        }
                    }
                    var _valid2 = _errs24 === errors;
                    if (_valid2 && valid6) {
                        valid6 = false;
                        passing1 = [passing1, 1];
                    }
                    else {
                        if (_valid2) {
                            valid6 = true;
                            passing1 = 1;
                        }
                        const _errs29 = errors;
                        if (!(validate11(data2, { instancePath: instancePath + "/sm", parentData: data, parentDataProperty: "sm", rootData }))) {
                            vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                            errors = vErrors.length;
                        }
                        var _valid2 = _errs29 === errors;
                        if (_valid2 && valid6) {
                            valid6 = false;
                            passing1 = [passing1, 2];
                        }
                        else {
                            if (_valid2) {
                                valid6 = true;
                                passing1 = 2;
                            }
                        }
                    }
                    if (!valid6) {
                        const err15 = { instancePath: instancePath + "/sm", schemaPath: "#/properties/sm/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                        if (vErrors === null) {
                            vErrors = [err15];
                        }
                        else {
                            vErrors.push(err15);
                        }
                        errors++;
                        validate13.errors = vErrors;
                        return false;
                    }
                    else {
                        errors = _errs20;
                        if (vErrors !== null) {
                            if (_errs20) {
                                vErrors.length = _errs20;
                            }
                            else {
                                vErrors = null;
                            }
                        }
                    }
                    var valid1 = _errs19 === errors;
                }
                else {
                    var valid1 = true;
                }
                if (valid1) {
                    if (data.md !== undefined) {
                        let data4 = data.md;
                        const _errs30 = errors;
                        const _errs31 = errors;
                        let valid10 = false;
                        let passing2 = null;
                        const _errs32 = errors;
                        if (typeof data4 !== "string") {
                            const err16 = { instancePath: instancePath + "/md", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                            if (vErrors === null) {
                                vErrors = [err16];
                            }
                            else {
                                vErrors.push(err16);
                            }
                            errors++;
                        }
                        if (!(((data4 === "text-field") || (data4 === "textarea")) || (data4 === "checkbox"))) {
                            const err17 = { instancePath: instancePath + "/md", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                            if (vErrors === null) {
                                vErrors = [err17];
                            }
                            else {
                                vErrors.push(err17);
                            }
                            errors++;
                        }
                        var _valid3 = _errs32 === errors;
                        if (_valid3) {
                            valid10 = true;
                            passing2 = 0;
                        }
                        const _errs35 = errors;
                        const _errs36 = errors;
                        if (errors === _errs36) {
                            if (Array.isArray(data4)) {
                                var valid13 = true;
                                const len2 = data4.length;
                                for (let i2 = 0; i2 < len2; i2++) {
                                    const _errs38 = errors;
                                    if (typeof data4[i2] !== "string") {
                                        const err18 = { instancePath: instancePath + "/md/" + i2, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                        if (vErrors === null) {
                                            vErrors = [err18];
                                        }
                                        else {
                                            vErrors.push(err18);
                                        }
                                        errors++;
                                    }
                                    var valid13 = _errs38 === errors;
                                    if (!valid13) {
                                        break;
                                    }
                                }
                            }
                            else {
                                const err19 = { instancePath: instancePath + "/md", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                if (vErrors === null) {
                                    vErrors = [err19];
                                }
                                else {
                                    vErrors.push(err19);
                                }
                                errors++;
                            }
                        }
                        var _valid3 = _errs35 === errors;
                        if (_valid3 && valid10) {
                            valid10 = false;
                            passing2 = [passing2, 1];
                        }
                        else {
                            if (_valid3) {
                                valid10 = true;
                                passing2 = 1;
                            }
                            const _errs40 = errors;
                            if (!(validate11(data4, { instancePath: instancePath + "/md", parentData: data, parentDataProperty: "md", rootData }))) {
                                vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                                errors = vErrors.length;
                            }
                            var _valid3 = _errs40 === errors;
                            if (_valid3 && valid10) {
                                valid10 = false;
                                passing2 = [passing2, 2];
                            }
                            else {
                                if (_valid3) {
                                    valid10 = true;
                                    passing2 = 2;
                                }
                            }
                        }
                        if (!valid10) {
                            const err20 = { instancePath: instancePath + "/md", schemaPath: "#/properties/md/oneOf", keyword: "oneOf", params: { passingSchemas: passing2 }, message: "must match exactly one schema in oneOf" };
                            if (vErrors === null) {
                                vErrors = [err20];
                            }
                            else {
                                vErrors.push(err20);
                            }
                            errors++;
                            validate13.errors = vErrors;
                            return false;
                        }
                        else {
                            errors = _errs31;
                            if (vErrors !== null) {
                                if (_errs31) {
                                    vErrors.length = _errs31;
                                }
                                else {
                                    vErrors = null;
                                }
                            }
                        }
                        var valid1 = _errs30 === errors;
                    }
                    else {
                        var valid1 = true;
                    }
                    if (valid1) {
                        if (data.lg !== undefined) {
                            let data6 = data.lg;
                            const _errs41 = errors;
                            const _errs42 = errors;
                            let valid14 = false;
                            let passing3 = null;
                            const _errs43 = errors;
                            if (typeof data6 !== "string") {
                                const err21 = { instancePath: instancePath + "/lg", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                    vErrors = [err21];
                                }
                                else {
                                    vErrors.push(err21);
                                }
                                errors++;
                            }
                            if (!(((data6 === "text-field") || (data6 === "textarea")) || (data6 === "checkbox"))) {
                                const err22 = { instancePath: instancePath + "/lg", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                                if (vErrors === null) {
                                    vErrors = [err22];
                                }
                                else {
                                    vErrors.push(err22);
                                }
                                errors++;
                            }
                            var _valid4 = _errs43 === errors;
                            if (_valid4) {
                                valid14 = true;
                                passing3 = 0;
                            }
                            const _errs46 = errors;
                            const _errs47 = errors;
                            if (errors === _errs47) {
                                if (Array.isArray(data6)) {
                                    var valid17 = true;
                                    const len3 = data6.length;
                                    for (let i3 = 0; i3 < len3; i3++) {
                                        const _errs49 = errors;
                                        if (typeof data6[i3] !== "string") {
                                            const err23 = { instancePath: instancePath + "/lg/" + i3, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                            if (vErrors === null) {
                                                vErrors = [err23];
                                            }
                                            else {
                                                vErrors.push(err23);
                                            }
                                            errors++;
                                        }
                                        var valid17 = _errs49 === errors;
                                        if (!valid17) {
                                            break;
                                        }
                                    }
                                }
                                else {
                                    const err24 = { instancePath: instancePath + "/lg", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                    if (vErrors === null) {
                                        vErrors = [err24];
                                    }
                                    else {
                                        vErrors.push(err24);
                                    }
                                    errors++;
                                }
                            }
                            var _valid4 = _errs46 === errors;
                            if (_valid4 && valid14) {
                                valid14 = false;
                                passing3 = [passing3, 1];
                            }
                            else {
                                if (_valid4) {
                                    valid14 = true;
                                    passing3 = 1;
                                }
                                const _errs51 = errors;
                                if (!(validate11(data6, { instancePath: instancePath + "/lg", parentData: data, parentDataProperty: "lg", rootData }))) {
                                    vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                                    errors = vErrors.length;
                                }
                                var _valid4 = _errs51 === errors;
                                if (_valid4 && valid14) {
                                    valid14 = false;
                                    passing3 = [passing3, 2];
                                }
                                else {
                                    if (_valid4) {
                                        valid14 = true;
                                        passing3 = 2;
                                    }
                                }
                            }
                            if (!valid14) {
                                const err25 = { instancePath: instancePath + "/lg", schemaPath: "#/properties/lg/oneOf", keyword: "oneOf", params: { passingSchemas: passing3 }, message: "must match exactly one schema in oneOf" };
                                if (vErrors === null) {
                                    vErrors = [err25];
                                }
                                else {
                                    vErrors.push(err25);
                                }
                                errors++;
                                validate13.errors = vErrors;
                                return false;
                            }
                            else {
                                errors = _errs42;
                                if (vErrors !== null) {
                                    if (_errs42) {
                                        vErrors.length = _errs42;
                                    }
                                    else {
                                        vErrors = null;
                                    }
                                }
                            }
                            var valid1 = _errs41 === errors;
                        }
                        else {
                            var valid1 = true;
                        }
                        if (valid1) {
                            if (data.xl !== undefined) {
                                let data8 = data.xl;
                                const _errs52 = errors;
                                const _errs53 = errors;
                                let valid18 = false;
                                let passing4 = null;
                                const _errs54 = errors;
                                if (typeof data8 !== "string") {
                                    const err26 = { instancePath: instancePath + "/xl", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                        vErrors = [err26];
                                    }
                                    else {
                                        vErrors.push(err26);
                                    }
                                    errors++;
                                }
                                if (!(((data8 === "text-field") || (data8 === "textarea")) || (data8 === "checkbox"))) {
                                    const err27 = { instancePath: instancePath + "/xl", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                                    if (vErrors === null) {
                                        vErrors = [err27];
                                    }
                                    else {
                                        vErrors.push(err27);
                                    }
                                    errors++;
                                }
                                var _valid5 = _errs54 === errors;
                                if (_valid5) {
                                    valid18 = true;
                                    passing4 = 0;
                                }
                                const _errs57 = errors;
                                const _errs58 = errors;
                                if (errors === _errs58) {
                                    if (Array.isArray(data8)) {
                                        var valid21 = true;
                                        const len4 = data8.length;
                                        for (let i4 = 0; i4 < len4; i4++) {
                                            const _errs60 = errors;
                                            if (typeof data8[i4] !== "string") {
                                                const err28 = { instancePath: instancePath + "/xl/" + i4, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                                if (vErrors === null) {
                                                    vErrors = [err28];
                                                }
                                                else {
                                                    vErrors.push(err28);
                                                }
                                                errors++;
                                            }
                                            var valid21 = _errs60 === errors;
                                            if (!valid21) {
                                                break;
                                            }
                                        }
                                    }
                                    else {
                                        const err29 = { instancePath: instancePath + "/xl", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                                        if (vErrors === null) {
                                            vErrors = [err29];
                                        }
                                        else {
                                            vErrors.push(err29);
                                        }
                                        errors++;
                                    }
                                }
                                var _valid5 = _errs57 === errors;
                                if (_valid5 && valid18) {
                                    valid18 = false;
                                    passing4 = [passing4, 1];
                                }
                                else {
                                    if (_valid5) {
                                        valid18 = true;
                                        passing4 = 1;
                                    }
                                    const _errs62 = errors;
                                    if (!(validate11(data8, { instancePath: instancePath + "/xl", parentData: data, parentDataProperty: "xl", rootData }))) {
                                        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                                        errors = vErrors.length;
                                    }
                                    var _valid5 = _errs62 === errors;
                                    if (_valid5 && valid18) {
                                        valid18 = false;
                                        passing4 = [passing4, 2];
                                    }
                                    else {
                                        if (_valid5) {
                                            valid18 = true;
                                            passing4 = 2;
                                        }
                                    }
                                }
                                if (!valid18) {
                                    const err30 = { instancePath: instancePath + "/xl", schemaPath: "#/properties/xl/oneOf", keyword: "oneOf", params: { passingSchemas: passing4 }, message: "must match exactly one schema in oneOf" };
                                    if (vErrors === null) {
                                        vErrors = [err30];
                                    }
                                    else {
                                        vErrors.push(err30);
                                    }
                                    errors++;
                                    validate13.errors = vErrors;
                                    return false;
                                }
                                else {
                                    errors = _errs53;
                                    if (vErrors !== null) {
                                        if (_errs53) {
                                            vErrors.length = _errs53;
                                        }
                                        else {
                                            vErrors = null;
                                        }
                                    }
                                }
                                var valid1 = _errs52 === errors;
                            }
                            else {
                                var valid1 = true;
                            }
                        }
                    }
                }
            }
        }
    }
    else {
        validate13.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate13.errors = vErrors; return errors === 0; }
const schema28 = { "type": "object", "additionalProperties": false, "properties": { "read": { "description": "apply this layout if data is rendered read only", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }, { "$ref": "#/$defs/responsive" }] }, "write": { "description": "apply this layout if data is rendered for writes", "oneOf": [{ "$ref": "#/$defs/comp" }, { "$ref": "#/$defs/children" }, { "$ref": "#/$defs/partial" }, { "$ref": "#/$defs/responsive" }] } }, "anyOf": [{ "required": ["read"] }, { "required": ["write"] }] };
function validate20(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { let vErrors = null; let errors = 0; const _errs1 = errors; let valid0 = false; const _errs2 = errors; if (data && typeof data == "object" && !Array.isArray(data)) {
    let missing0;
    if ((data.read === undefined) && (missing0 = "read")) {
        const err0 = { instancePath, schemaPath: "#/anyOf/0/required", keyword: "required", params: { missingProperty: missing0 }, message: "must have required property '" + missing0 + "'" };
        if (vErrors === null) {
            vErrors = [err0];
        }
        else {
            vErrors.push(err0);
        }
        errors++;
    }
} var _valid0 = _errs2 === errors; valid0 = valid0 || _valid0; if (!valid0) {
    const _errs3 = errors;
    if (data && typeof data == "object" && !Array.isArray(data)) {
        let missing1;
        if ((data.write === undefined) && (missing1 = "write")) {
            const err1 = { instancePath, schemaPath: "#/anyOf/1/required", keyword: "required", params: { missingProperty: missing1 }, message: "must have required property '" + missing1 + "'" };
            if (vErrors === null) {
                vErrors = [err1];
            }
            else {
                vErrors.push(err1);
            }
            errors++;
        }
    }
    var _valid0 = _errs3 === errors;
    valid0 = valid0 || _valid0;
} if (!valid0) {
    const err2 = { instancePath, schemaPath: "#/anyOf", keyword: "anyOf", params: {}, message: "must match a schema in anyOf" };
    if (vErrors === null) {
        vErrors = [err2];
    }
    else {
        vErrors.push(err2);
    }
    errors++;
    validate20.errors = vErrors;
    return false;
}
else {
    errors = _errs1;
    if (vErrors !== null) {
        if (_errs1) {
            vErrors.length = _errs1;
        }
        else {
            vErrors = null;
        }
    }
} if (errors === 0) {
    if (data && typeof data == "object" && !Array.isArray(data)) {
        const _errs4 = errors;
        for (const key0 in data) {
            if (!((key0 === "read") || (key0 === "write"))) {
                validate20.errors = [{ instancePath, schemaPath: "#/additionalProperties", keyword: "additionalProperties", params: { additionalProperty: key0 }, message: "must NOT have additional properties" }];
                return false;
                break;
            }
        }
        if (_errs4 === errors) {
            if (data.read !== undefined) {
                let data0 = data.read;
                const _errs5 = errors;
                const _errs6 = errors;
                let valid2 = false;
                let passing0 = null;
                const _errs7 = errors;
                if (typeof data0 !== "string") {
                    const err3 = { instancePath: instancePath + "/read", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                    if (vErrors === null) {
                        vErrors = [err3];
                    }
                    else {
                        vErrors.push(err3);
                    }
                    errors++;
                }
                if (!(((data0 === "text-field") || (data0 === "textarea")) || (data0 === "checkbox"))) {
                    const err4 = { instancePath: instancePath + "/read", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                    if (vErrors === null) {
                        vErrors = [err4];
                    }
                    else {
                        vErrors.push(err4);
                    }
                    errors++;
                }
                var _valid1 = _errs7 === errors;
                if (_valid1) {
                    valid2 = true;
                    passing0 = 0;
                }
                const _errs10 = errors;
                const _errs11 = errors;
                if (errors === _errs11) {
                    if (Array.isArray(data0)) {
                        var valid5 = true;
                        const len0 = data0.length;
                        for (let i0 = 0; i0 < len0; i0++) {
                            const _errs13 = errors;
                            if (typeof data0[i0] !== "string") {
                                const err5 = { instancePath: instancePath + "/read/" + i0, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                if (vErrors === null) {
                                    vErrors = [err5];
                                }
                                else {
                                    vErrors.push(err5);
                                }
                                errors++;
                            }
                            var valid5 = _errs13 === errors;
                            if (!valid5) {
                                break;
                            }
                        }
                    }
                    else {
                        const err6 = { instancePath: instancePath + "/read", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                        if (vErrors === null) {
                            vErrors = [err6];
                        }
                        else {
                            vErrors.push(err6);
                        }
                        errors++;
                    }
                }
                var _valid1 = _errs10 === errors;
                if (_valid1 && valid2) {
                    valid2 = false;
                    passing0 = [passing0, 1];
                }
                else {
                    if (_valid1) {
                        valid2 = true;
                        passing0 = 1;
                    }
                    const _errs15 = errors;
                    if (!(validate11(data0, { instancePath: instancePath + "/read", parentData: data, parentDataProperty: "read", rootData }))) {
                        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                        errors = vErrors.length;
                    }
                    var _valid1 = _errs15 === errors;
                    if (_valid1 && valid2) {
                        valid2 = false;
                        passing0 = [passing0, 2];
                    }
                    else {
                        if (_valid1) {
                            valid2 = true;
                            passing0 = 2;
                        }
                        const _errs16 = errors;
                        if (!(validate13(data0, { instancePath: instancePath + "/read", parentData: data, parentDataProperty: "read", rootData }))) {
                            vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
                            errors = vErrors.length;
                        }
                        var _valid1 = _errs16 === errors;
                        if (_valid1 && valid2) {
                            valid2 = false;
                            passing0 = [passing0, 3];
                        }
                        else {
                            if (_valid1) {
                                valid2 = true;
                                passing0 = 3;
                            }
                        }
                    }
                }
                if (!valid2) {
                    const err7 = { instancePath: instancePath + "/read", schemaPath: "#/properties/read/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
                    if (vErrors === null) {
                        vErrors = [err7];
                    }
                    else {
                        vErrors.push(err7);
                    }
                    errors++;
                    validate20.errors = vErrors;
                    return false;
                }
                else {
                    errors = _errs6;
                    if (vErrors !== null) {
                        if (_errs6) {
                            vErrors.length = _errs6;
                        }
                        else {
                            vErrors = null;
                        }
                    }
                }
                var valid1 = _errs5 === errors;
            }
            else {
                var valid1 = true;
            }
            if (valid1) {
                if (data.write !== undefined) {
                    let data2 = data.write;
                    const _errs17 = errors;
                    const _errs18 = errors;
                    let valid6 = false;
                    let passing1 = null;
                    const _errs19 = errors;
                    if (typeof data2 !== "string") {
                        const err8 = { instancePath: instancePath + "/write", schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                        if (vErrors === null) {
                            vErrors = [err8];
                        }
                        else {
                            vErrors.push(err8);
                        }
                        errors++;
                    }
                    if (!(((data2 === "text-field") || (data2 === "textarea")) || (data2 === "checkbox"))) {
                        const err9 = { instancePath: instancePath + "/write", schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
                        if (vErrors === null) {
                            vErrors = [err9];
                        }
                        else {
                            vErrors.push(err9);
                        }
                        errors++;
                    }
                    var _valid2 = _errs19 === errors;
                    if (_valid2) {
                        valid6 = true;
                        passing1 = 0;
                    }
                    const _errs22 = errors;
                    const _errs23 = errors;
                    if (errors === _errs23) {
                        if (Array.isArray(data2)) {
                            var valid9 = true;
                            const len1 = data2.length;
                            for (let i1 = 0; i1 < len1; i1++) {
                                const _errs25 = errors;
                                if (typeof data2[i1] !== "string") {
                                    const err10 = { instancePath: instancePath + "/write/" + i1, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                                    if (vErrors === null) {
                                        vErrors = [err10];
                                    }
                                    else {
                                        vErrors.push(err10);
                                    }
                                    errors++;
                                }
                                var valid9 = _errs25 === errors;
                                if (!valid9) {
                                    break;
                                }
                            }
                        }
                        else {
                            const err11 = { instancePath: instancePath + "/write", schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
                            if (vErrors === null) {
                                vErrors = [err11];
                            }
                            else {
                                vErrors.push(err11);
                            }
                            errors++;
                        }
                    }
                    var _valid2 = _errs22 === errors;
                    if (_valid2 && valid6) {
                        valid6 = false;
                        passing1 = [passing1, 1];
                    }
                    else {
                        if (_valid2) {
                            valid6 = true;
                            passing1 = 1;
                        }
                        const _errs27 = errors;
                        if (!(validate11(data2, { instancePath: instancePath + "/write", parentData: data, parentDataProperty: "write", rootData }))) {
                            vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
                            errors = vErrors.length;
                        }
                        var _valid2 = _errs27 === errors;
                        if (_valid2 && valid6) {
                            valid6 = false;
                            passing1 = [passing1, 2];
                        }
                        else {
                            if (_valid2) {
                                valid6 = true;
                                passing1 = 2;
                            }
                            const _errs28 = errors;
                            if (!(validate13(data2, { instancePath: instancePath + "/write", parentData: data, parentDataProperty: "write", rootData }))) {
                                vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
                                errors = vErrors.length;
                            }
                            var _valid2 = _errs28 === errors;
                            if (_valid2 && valid6) {
                                valid6 = false;
                                passing1 = [passing1, 3];
                            }
                            else {
                                if (_valid2) {
                                    valid6 = true;
                                    passing1 = 3;
                                }
                            }
                        }
                    }
                    if (!valid6) {
                        const err12 = { instancePath: instancePath + "/write", schemaPath: "#/properties/write/oneOf", keyword: "oneOf", params: { passingSchemas: passing1 }, message: "must match exactly one schema in oneOf" };
                        if (vErrors === null) {
                            vErrors = [err12];
                        }
                        else {
                            vErrors.push(err12);
                        }
                        errors++;
                        validate20.errors = vErrors;
                        return false;
                    }
                    else {
                        errors = _errs18;
                        if (vErrors !== null) {
                            if (_errs18) {
                                vErrors.length = _errs18;
                            }
                            else {
                                vErrors = null;
                            }
                        }
                    }
                    var valid1 = _errs17 === errors;
                }
                else {
                    var valid1 = true;
                }
            }
        }
    }
    else {
        validate20.errors = [{ instancePath, schemaPath: "#/type", keyword: "type", params: { type: "object" }, message: "must be object" }];
        return false;
    }
} validate20.errors = vErrors; return errors === 0; }
function validate10(data, { instancePath = "", parentData, parentDataProperty, rootData = data } = {}) { /*# sourceURL="https://json-layout.github.io/layout-keyword" */ ; let vErrors = null; let errors = 0; const _errs0 = errors; let valid0 = false; let passing0 = null; const _errs1 = errors; if (typeof data !== "string") {
    const err0 = { instancePath, schemaPath: "#/$defs/comp/type", keyword: "type", params: { type: "string" }, message: "must be string" };
    if (vErrors === null) {
        vErrors = [err0];
    }
    else {
        vErrors.push(err0);
    }
    errors++;
} if (!(((data === "text-field") || (data === "textarea")) || (data === "checkbox"))) {
    const err1 = { instancePath, schemaPath: "#/$defs/comp/enum", keyword: "enum", params: { allowedValues: schema12.enum }, message: "must be equal to one of the allowed values" };
    if (vErrors === null) {
        vErrors = [err1];
    }
    else {
        vErrors.push(err1);
    }
    errors++;
} var _valid0 = _errs1 === errors; if (_valid0) {
    valid0 = true;
    passing0 = 0;
} const _errs4 = errors; const _errs5 = errors; if (errors === _errs5) {
    if (Array.isArray(data)) {
        var valid3 = true;
        const len0 = data.length;
        for (let i0 = 0; i0 < len0; i0++) {
            const _errs7 = errors;
            if (typeof data[i0] !== "string") {
                const err2 = { instancePath: instancePath + "/" + i0, schemaPath: "#/$defs/children/items/type", keyword: "type", params: { type: "string" }, message: "must be string" };
                if (vErrors === null) {
                    vErrors = [err2];
                }
                else {
                    vErrors.push(err2);
                }
                errors++;
            }
            var valid3 = _errs7 === errors;
            if (!valid3) {
                break;
            }
        }
    }
    else {
        const err3 = { instancePath, schemaPath: "#/$defs/children/type", keyword: "type", params: { type: "array" }, message: "must be array" };
        if (vErrors === null) {
            vErrors = [err3];
        }
        else {
            vErrors.push(err3);
        }
        errors++;
    }
} var _valid0 = _errs4 === errors; if (_valid0 && valid0) {
    valid0 = false;
    passing0 = [passing0, 1];
}
else {
    if (_valid0) {
        valid0 = true;
        passing0 = 1;
    }
    const _errs9 = errors;
    if (!(validate11(data, { instancePath, parentData, parentDataProperty, rootData }))) {
        vErrors = vErrors === null ? validate11.errors : vErrors.concat(validate11.errors);
        errors = vErrors.length;
    }
    var _valid0 = _errs9 === errors;
    if (_valid0 && valid0) {
        valid0 = false;
        passing0 = [passing0, 2];
    }
    else {
        if (_valid0) {
            valid0 = true;
            passing0 = 2;
        }
        const _errs10 = errors;
        if (!(validate13(data, { instancePath, parentData, parentDataProperty, rootData }))) {
            vErrors = vErrors === null ? validate13.errors : vErrors.concat(validate13.errors);
            errors = vErrors.length;
        }
        var _valid0 = _errs10 === errors;
        if (_valid0 && valid0) {
            valid0 = false;
            passing0 = [passing0, 3];
        }
        else {
            if (_valid0) {
                valid0 = true;
                passing0 = 3;
            }
            const _errs11 = errors;
            if (!(validate20(data, { instancePath, parentData, parentDataProperty, rootData }))) {
                vErrors = vErrors === null ? validate20.errors : vErrors.concat(validate20.errors);
                errors = vErrors.length;
            }
            var _valid0 = _errs11 === errors;
            if (_valid0 && valid0) {
                valid0 = false;
                passing0 = [passing0, 4];
            }
            else {
                if (_valid0) {
                    valid0 = true;
                    passing0 = 4;
                }
            }
        }
    }
} if (!valid0) {
    const err4 = { instancePath, schemaPath: "#/oneOf", keyword: "oneOf", params: { passingSchemas: passing0 }, message: "must match exactly one schema in oneOf" };
    if (vErrors === null) {
        vErrors = [err4];
    }
    else {
        vErrors.push(err4);
    }
    errors++;
    validate10.errors = vErrors;
    return false;
}
else {
    errors = _errs0;
    if (vErrors !== null) {
        if (_errs0) {
            vErrors.length = _errs0;
        }
        else {
            vErrors = null;
        }
    }
} validate10.errors = vErrors; return errors === 0; }
