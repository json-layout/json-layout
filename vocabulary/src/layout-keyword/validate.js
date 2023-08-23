"use strict";export const validate = validate18;export default validate18;const schema21 = {"$id":"https://json-layout.github.io/layout-keyword","title":"layout keyword","oneOf":[{"$ref":"#/$defs/comp-name"},{"$ref":"#/$defs/partial-children"},{"$ref":"#/$defs/partial-comp-object"},{"$ref":"#/$defs/partial-switch"}],"$defs":{"partial-switch":{"type":"object","required":["switch"],"additionalProperties":false,"properties":{"switch":{"type":"array","items":{"$ref":"#/$defs/partial-comp-object"}}}},"partial-comp-object":{"title":"partial comp object","type":"object","additionalProperties":false,"properties":{"comp":{"$ref":"#/$defs/comp-name"},"children":{"$ref":"#/$defs/partial-children"},"label":{"type":"string"},"title":{"type":"string"},"step":{"type":"number"},"if":{"$ref":"#/$defs/partial-expression"},"items":{"type":"array","items":{"$ref":"#/$defs/partial-select-item"}},"getItems":{"$ref":"#/$defs/partial-get-items"}}},"comp-name":{"title":"component name","type":"string","enum":["none","text-field","number-field","textarea","checkbox","section","list","select"]},"partial-child":{"type":"object","unevaluatedProperties":false,"allOf":[{"$ref":"#/$defs/partial-comp-object"},{"properties":{"key":{"type":["string","integer"]},"width":{"type":"number"}}}]},"partial-children":{"type":"array","items":{"oneOf":[{"type":"string"},{"$ref":"#/$defs/partial-child"}]}},"partial-expression":{"oneOf":[{"type":"string"},{"type":"object","required":["expr"],"properties":{"type":{"type":"string","enum":["expr-eval","js-fn"],"default":"expr-eval"},"expr":{"type":"string"}}}]},"partial-select-item":{"oneOf":[{"type":"string"},{"type":"object","properties":{"key":{"type":"string"},"title":{"type":"string"},"value":{}}}]},"partial-get-items":{"oneOf":[{"$ref":"#/$defs/partial-expression"},{"type":"object","properties":{"url":{"type":"string"}}}]}}};const schema22 = {"title":"component name","type":"string","enum":["none","text-field","number-field","textarea","checkbox","section","list","select"]};const schema23 = {"type":"array","items":{"oneOf":[{"type":"string"},{"$ref":"#/$defs/partial-child"}]}};const schema24 = {"type":"object","unevaluatedProperties":false,"allOf":[{"$ref":"#/$defs/partial-comp-object"},{"properties":{"key":{"type":["string","integer"]},"width":{"type":"number"}}}]};const schema25 = {"title":"partial comp object","type":"object","additionalProperties":false,"properties":{"comp":{"$ref":"#/$defs/comp-name"},"children":{"$ref":"#/$defs/partial-children"},"label":{"type":"string"},"title":{"type":"string"},"step":{"type":"number"},"if":{"$ref":"#/$defs/partial-expression"},"items":{"type":"array","items":{"$ref":"#/$defs/partial-select-item"}},"getItems":{"$ref":"#/$defs/partial-get-items"}}};const schema27 = {"oneOf":[{"type":"string"},{"type":"object","required":["expr"],"properties":{"type":{"type":"string","enum":["expr-eval","js-fn"],"default":"expr-eval"},"expr":{"type":"string"}}}]};const schema28 = {"oneOf":[{"type":"string"},{"type":"object","properties":{"key":{"type":"string"},"title":{"type":"string"},"value":{}}}]};const wrapper0 = {validate: validate19};const schema29 = {"oneOf":[{"$ref":"#/$defs/partial-expression"},{"type":"object","properties":{"url":{"type":"string"}}}]};function validate22(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){let vErrors = null;let errors = 0;const evaluated0 = validate22.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}const _errs0 = errors;let valid0 = false;let passing0 = null;const _errs1 = errors;const _errs3 = errors;let valid2 = false;let passing1 = null;const _errs4 = errors;if(typeof data !== "string"){const err0 = {instancePath,schemaPath:"#/$defs/partial-expression/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}var _valid1 = _errs4 === errors;if(_valid1){valid2 = true;passing1 = 0;}const _errs6 = errors;if(errors === _errs6){if(data && typeof data == "object" && !Array.isArray(data)){let missing0;if((data.expr === undefined) && (missing0 = "expr")){const err1 = {instancePath,schemaPath:"#/$defs/partial-expression/oneOf/1/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}else {if(data.type !== undefined){let data0 = data.type;const _errs8 = errors;if(typeof data0 !== "string"){const err2 = {instancePath:instancePath+"/type",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/type/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}if(!((data0 === "expr-eval") || (data0 === "js-fn"))){const err3 = {instancePath:instancePath+"/type",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/type/enum",keyword:"enum",params:{allowedValues: schema27.oneOf[1].properties.type.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}var valid3 = _errs8 === errors;}else {var valid3 = true;}if(valid3){if(data.expr !== undefined){const _errs10 = errors;if(typeof data.expr !== "string"){const err4 = {instancePath:instancePath+"/expr",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/expr/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}var valid3 = _errs10 === errors;}else {var valid3 = true;}}}}else {const err5 = {instancePath,schemaPath:"#/$defs/partial-expression/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err5];}else {vErrors.push(err5);}errors++;}}var _valid1 = _errs6 === errors;if(_valid1 && valid2){valid2 = false;passing1 = [passing1, 1];}else {if(_valid1){valid2 = true;passing1 = 1;var props0 = {};props0.type = true;props0.expr = true;}}if(!valid2){const err6 = {instancePath,schemaPath:"#/$defs/partial-expression/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err6];}else {vErrors.push(err6);}errors++;}else {errors = _errs3;if(vErrors !== null){if(_errs3){vErrors.length = _errs3;}else {vErrors = null;}}}var _valid0 = _errs1 === errors;if(_valid0){valid0 = true;passing0 = 0;}const _errs12 = errors;if(errors === _errs12){if(data && typeof data == "object" && !Array.isArray(data)){if(data.url !== undefined){if(typeof data.url !== "string"){const err7 = {instancePath:instancePath+"/url",schemaPath:"#/oneOf/1/properties/url/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err7];}else {vErrors.push(err7);}errors++;}}}else {const err8 = {instancePath,schemaPath:"#/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err8];}else {vErrors.push(err8);}errors++;}}var _valid0 = _errs12 === errors;if(_valid0 && valid0){valid0 = false;passing0 = [passing0, 1];}else {if(_valid0){valid0 = true;passing0 = 1;if(props0 !== true){props0 = props0 || {};props0.url = true;}}}if(!valid0){const err9 = {instancePath,schemaPath:"#/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err9];}else {vErrors.push(err9);}errors++;validate22.errors = vErrors;return false;}else {errors = _errs0;if(vErrors !== null){if(_errs0){vErrors.length = _errs0;}else {vErrors = null;}}}validate22.errors = vErrors;evaluated0.props = props0;return errors === 0;}validate22.evaluated = {"dynamicProps":true,"dynamicItems":false};function validate21(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){let vErrors = null;let errors = 0;const evaluated0 = validate21.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}if(errors === 0){if(data && typeof data == "object" && !Array.isArray(data)){const _errs1 = errors;for(const key0 in data){if(!((((((((key0 === "comp") || (key0 === "children")) || (key0 === "label")) || (key0 === "title")) || (key0 === "step")) || (key0 === "if")) || (key0 === "items")) || (key0 === "getItems"))){validate21.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];return false;break;}}if(_errs1 === errors){if(data.comp !== undefined){let data0 = data.comp;const _errs2 = errors;if(typeof data0 !== "string"){validate21.errors = [{instancePath:instancePath+"/comp",schemaPath:"#/$defs/comp-name/type",keyword:"type",params:{type: "string"},message:"must be string"}];return false;}if(!((((((((data0 === "none") || (data0 === "text-field")) || (data0 === "number-field")) || (data0 === "textarea")) || (data0 === "checkbox")) || (data0 === "section")) || (data0 === "list")) || (data0 === "select"))){validate21.errors = [{instancePath:instancePath+"/comp",schemaPath:"#/$defs/comp-name/enum",keyword:"enum",params:{allowedValues: schema22.enum},message:"must be equal to one of the allowed values"}];return false;}var valid0 = _errs2 === errors;}else {var valid0 = true;}if(valid0){if(data.children !== undefined){const _errs5 = errors;if(!(wrapper0.validate(data.children, {instancePath:instancePath+"/children",parentData:data,parentDataProperty:"children",rootData,dynamicAnchors}))){vErrors = vErrors === null ? wrapper0.validate.errors : vErrors.concat(wrapper0.validate.errors);errors = vErrors.length;}var valid0 = _errs5 === errors;}else {var valid0 = true;}if(valid0){if(data.label !== undefined){const _errs6 = errors;if(typeof data.label !== "string"){validate21.errors = [{instancePath:instancePath+"/label",schemaPath:"#/properties/label/type",keyword:"type",params:{type: "string"},message:"must be string"}];return false;}var valid0 = _errs6 === errors;}else {var valid0 = true;}if(valid0){if(data.title !== undefined){const _errs8 = errors;if(typeof data.title !== "string"){validate21.errors = [{instancePath:instancePath+"/title",schemaPath:"#/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"}];return false;}var valid0 = _errs8 === errors;}else {var valid0 = true;}if(valid0){if(data.step !== undefined){let data4 = data.step;const _errs10 = errors;if(!((typeof data4 == "number") && (isFinite(data4)))){validate21.errors = [{instancePath:instancePath+"/step",schemaPath:"#/properties/step/type",keyword:"type",params:{type: "number"},message:"must be number"}];return false;}var valid0 = _errs10 === errors;}else {var valid0 = true;}if(valid0){if(data.if !== undefined){let data5 = data.if;const _errs12 = errors;const _errs14 = errors;let valid3 = false;let passing0 = null;const _errs15 = errors;if(typeof data5 !== "string"){const err0 = {instancePath:instancePath+"/if",schemaPath:"#/$defs/partial-expression/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}var _valid0 = _errs15 === errors;if(_valid0){valid3 = true;passing0 = 0;}const _errs17 = errors;if(errors === _errs17){if(data5 && typeof data5 == "object" && !Array.isArray(data5)){let missing0;if((data5.expr === undefined) && (missing0 = "expr")){const err1 = {instancePath:instancePath+"/if",schemaPath:"#/$defs/partial-expression/oneOf/1/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}else {if(data5.type !== undefined){let data6 = data5.type;const _errs19 = errors;if(typeof data6 !== "string"){const err2 = {instancePath:instancePath+"/if/type",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/type/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;}if(!((data6 === "expr-eval") || (data6 === "js-fn"))){const err3 = {instancePath:instancePath+"/if/type",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/type/enum",keyword:"enum",params:{allowedValues: schema27.oneOf[1].properties.type.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err3];}else {vErrors.push(err3);}errors++;}var valid4 = _errs19 === errors;}else {var valid4 = true;}if(valid4){if(data5.expr !== undefined){const _errs21 = errors;if(typeof data5.expr !== "string"){const err4 = {instancePath:instancePath+"/if/expr",schemaPath:"#/$defs/partial-expression/oneOf/1/properties/expr/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err4];}else {vErrors.push(err4);}errors++;}var valid4 = _errs21 === errors;}else {var valid4 = true;}}}}else {const err5 = {instancePath:instancePath+"/if",schemaPath:"#/$defs/partial-expression/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err5];}else {vErrors.push(err5);}errors++;}}var _valid0 = _errs17 === errors;if(_valid0 && valid3){valid3 = false;passing0 = [passing0, 1];}else {if(_valid0){valid3 = true;passing0 = 1;var props1 = {};props1.type = true;props1.expr = true;}}if(!valid3){const err6 = {instancePath:instancePath+"/if",schemaPath:"#/$defs/partial-expression/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err6];}else {vErrors.push(err6);}errors++;validate21.errors = vErrors;return false;}else {errors = _errs14;if(vErrors !== null){if(_errs14){vErrors.length = _errs14;}else {vErrors = null;}}}var valid0 = _errs12 === errors;}else {var valid0 = true;}if(valid0){if(data.items !== undefined){let data8 = data.items;const _errs23 = errors;if(errors === _errs23){if(Array.isArray(data8)){var valid5 = true;const len0 = data8.length;for(let i0=0; i0<len0; i0++){let data9 = data8[i0];const _errs25 = errors;const _errs27 = errors;let valid7 = false;let passing1 = null;const _errs28 = errors;if(typeof data9 !== "string"){const err7 = {instancePath:instancePath+"/items/" + i0,schemaPath:"#/$defs/partial-select-item/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err7];}else {vErrors.push(err7);}errors++;}var _valid1 = _errs28 === errors;if(_valid1){valid7 = true;passing1 = 0;}const _errs30 = errors;if(errors === _errs30){if(data9 && typeof data9 == "object" && !Array.isArray(data9)){if(data9.key !== undefined){const _errs32 = errors;if(typeof data9.key !== "string"){const err8 = {instancePath:instancePath+"/items/" + i0+"/key",schemaPath:"#/$defs/partial-select-item/oneOf/1/properties/key/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err8];}else {vErrors.push(err8);}errors++;}var valid8 = _errs32 === errors;}else {var valid8 = true;}if(valid8){if(data9.title !== undefined){const _errs34 = errors;if(typeof data9.title !== "string"){const err9 = {instancePath:instancePath+"/items/" + i0+"/title",schemaPath:"#/$defs/partial-select-item/oneOf/1/properties/title/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err9];}else {vErrors.push(err9);}errors++;}var valid8 = _errs34 === errors;}else {var valid8 = true;}}}else {const err10 = {instancePath:instancePath+"/items/" + i0,schemaPath:"#/$defs/partial-select-item/oneOf/1/type",keyword:"type",params:{type: "object"},message:"must be object"};if(vErrors === null){vErrors = [err10];}else {vErrors.push(err10);}errors++;}}var _valid1 = _errs30 === errors;if(_valid1 && valid7){valid7 = false;passing1 = [passing1, 1];}else {if(_valid1){valid7 = true;passing1 = 1;var props2 = {};props2.key = true;props2.title = true;props2.value = true;}}if(!valid7){const err11 = {instancePath:instancePath+"/items/" + i0,schemaPath:"#/$defs/partial-select-item/oneOf",keyword:"oneOf",params:{passingSchemas: passing1},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err11];}else {vErrors.push(err11);}errors++;validate21.errors = vErrors;return false;}else {errors = _errs27;if(vErrors !== null){if(_errs27){vErrors.length = _errs27;}else {vErrors = null;}}}var valid5 = _errs25 === errors;if(!valid5){break;}}}else {validate21.errors = [{instancePath:instancePath+"/items",schemaPath:"#/properties/items/type",keyword:"type",params:{type: "array"},message:"must be array"}];return false;}}var valid0 = _errs23 === errors;}else {var valid0 = true;}if(valid0){if(data.getItems !== undefined){const _errs36 = errors;if(!(validate22(data.getItems, {instancePath:instancePath+"/getItems",parentData:data,parentDataProperty:"getItems",rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate22.errors : vErrors.concat(validate22.errors);errors = vErrors.length;}var valid0 = _errs36 === errors;}else {var valid0 = true;}}}}}}}}}}else {validate21.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];return false;}}validate21.errors = vErrors;return errors === 0;}validate21.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};function validate20(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){let vErrors = null;let errors = 0;const evaluated0 = validate20.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}const _errs1 = errors;if(!(validate21(data, {instancePath,parentData,parentDataProperty,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);errors = vErrors.length;}var valid0 = _errs1 === errors;if(valid0){const _errs2 = errors;if(data && typeof data == "object" && !Array.isArray(data)){if(data.key !== undefined){let data0 = data.key;const _errs3 = errors;if((typeof data0 !== "string") && (!(((typeof data0 == "number") && (!(data0 % 1) && !isNaN(data0))) && (isFinite(data0))))){validate20.errors = [{instancePath:instancePath+"/key",schemaPath:"#/allOf/1/properties/key/type",keyword:"type",params:{type: schema24.allOf[1].properties.key.type},message:"must be string,integer"}];return false;}var valid1 = _errs3 === errors;}else {var valid1 = true;}if(valid1){if(data.width !== undefined){let data1 = data.width;const _errs5 = errors;if(!((typeof data1 == "number") && (isFinite(data1)))){validate20.errors = [{instancePath:instancePath+"/width",schemaPath:"#/allOf/1/properties/width/type",keyword:"type",params:{type: "number"},message:"must be number"}];return false;}var valid1 = _errs5 === errors;}else {var valid1 = true;}}}var valid0 = _errs2 === errors;}if(errors === 0){if(data && typeof data == "object" && !Array.isArray(data)){}else {validate20.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];return false;}}validate20.errors = vErrors;return errors === 0;}validate20.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};function validate19(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){let vErrors = null;let errors = 0;const evaluated0 = validate19.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}if(errors === 0){if(Array.isArray(data)){var valid0 = true;const len0 = data.length;for(let i0=0; i0<len0; i0++){let data0 = data[i0];const _errs1 = errors;const _errs2 = errors;let valid1 = false;let passing0 = null;const _errs3 = errors;if(typeof data0 !== "string"){const err0 = {instancePath:instancePath+"/" + i0,schemaPath:"#/items/oneOf/0/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}var _valid0 = _errs3 === errors;if(_valid0){valid1 = true;passing0 = 0;}const _errs5 = errors;if(!(validate20(data0, {instancePath:instancePath+"/" + i0,parentData:data,parentDataProperty:i0,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate20.errors : vErrors.concat(validate20.errors);errors = vErrors.length;}var _valid0 = _errs5 === errors;if(_valid0 && valid1){valid1 = false;passing0 = [passing0, 1];}else {if(_valid0){valid1 = true;passing0 = 1;}}if(!valid1){const err1 = {instancePath:instancePath+"/" + i0,schemaPath:"#/items/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;validate19.errors = vErrors;return false;}else {errors = _errs2;if(vErrors !== null){if(_errs2){vErrors.length = _errs2;}else {vErrors = null;}}}var valid0 = _errs1 === errors;if(!valid0){break;}}}else {validate19.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "array"},message:"must be array"}];return false;}}validate19.errors = vErrors;return errors === 0;}validate19.evaluated = {"items":true,"dynamicProps":false,"dynamicItems":false};const schema31 = {"type":"object","required":["switch"],"additionalProperties":false,"properties":{"switch":{"type":"array","items":{"$ref":"#/$defs/partial-comp-object"}}}};function validate28(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){let vErrors = null;let errors = 0;const evaluated0 = validate28.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}if(errors === 0){if(data && typeof data == "object" && !Array.isArray(data)){let missing0;if((data.switch === undefined) && (missing0 = "switch")){validate28.errors = [{instancePath,schemaPath:"#/required",keyword:"required",params:{missingProperty: missing0},message:"must have required property '"+missing0+"'"}];return false;}else {const _errs1 = errors;for(const key0 in data){if(!(key0 === "switch")){validate28.errors = [{instancePath,schemaPath:"#/additionalProperties",keyword:"additionalProperties",params:{additionalProperty: key0},message:"must NOT have additional properties"}];return false;break;}}if(_errs1 === errors){if(data.switch !== undefined){let data0 = data.switch;const _errs2 = errors;if(errors === _errs2){if(Array.isArray(data0)){var valid1 = true;const len0 = data0.length;for(let i0=0; i0<len0; i0++){const _errs4 = errors;if(!(validate21(data0[i0], {instancePath:instancePath+"/switch/" + i0,parentData:data0,parentDataProperty:i0,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);errors = vErrors.length;}var valid1 = _errs4 === errors;if(!valid1){break;}}}else {validate28.errors = [{instancePath:instancePath+"/switch",schemaPath:"#/properties/switch/type",keyword:"type",params:{type: "array"},message:"must be array"}];return false;}}}}}}else {validate28.errors = [{instancePath,schemaPath:"#/type",keyword:"type",params:{type: "object"},message:"must be object"}];return false;}}validate28.errors = vErrors;return errors === 0;}validate28.evaluated = {"props":true,"dynamicProps":false,"dynamicItems":false};function validate18(data, {instancePath="", parentData, parentDataProperty, rootData=data, dynamicAnchors={}}={}){/*# sourceURL="https://json-layout.github.io/layout-keyword" */;let vErrors = null;let errors = 0;const evaluated0 = validate18.evaluated;if(evaluated0.dynamicProps){evaluated0.props = undefined;}if(evaluated0.dynamicItems){evaluated0.items = undefined;}const _errs0 = errors;let valid0 = false;let passing0 = null;const _errs1 = errors;if(typeof data !== "string"){const err0 = {instancePath,schemaPath:"#/$defs/comp-name/type",keyword:"type",params:{type: "string"},message:"must be string"};if(vErrors === null){vErrors = [err0];}else {vErrors.push(err0);}errors++;}if(!((((((((data === "none") || (data === "text-field")) || (data === "number-field")) || (data === "textarea")) || (data === "checkbox")) || (data === "section")) || (data === "list")) || (data === "select"))){const err1 = {instancePath,schemaPath:"#/$defs/comp-name/enum",keyword:"enum",params:{allowedValues: schema22.enum},message:"must be equal to one of the allowed values"};if(vErrors === null){vErrors = [err1];}else {vErrors.push(err1);}errors++;}var _valid0 = _errs1 === errors;if(_valid0){valid0 = true;passing0 = 0;}const _errs4 = errors;if(!(validate19(data, {instancePath,parentData,parentDataProperty,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate19.errors : vErrors.concat(validate19.errors);errors = vErrors.length;}var _valid0 = _errs4 === errors;if(_valid0 && valid0){valid0 = false;passing0 = [passing0, 1];}else {if(_valid0){valid0 = true;passing0 = 1;var items0 = true;}const _errs5 = errors;if(!(validate21(data, {instancePath,parentData,parentDataProperty,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate21.errors : vErrors.concat(validate21.errors);errors = vErrors.length;}var _valid0 = _errs5 === errors;if(_valid0 && valid0){valid0 = false;passing0 = [passing0, 2];}else {if(_valid0){valid0 = true;passing0 = 2;var props0 = true;}const _errs6 = errors;if(!(validate28(data, {instancePath,parentData,parentDataProperty,rootData,dynamicAnchors}))){vErrors = vErrors === null ? validate28.errors : vErrors.concat(validate28.errors);errors = vErrors.length;}var _valid0 = _errs6 === errors;if(_valid0 && valid0){valid0 = false;passing0 = [passing0, 3];}else {if(_valid0){valid0 = true;passing0 = 3;if(props0 !== true){props0 = true;}}}}}if(!valid0){const err2 = {instancePath,schemaPath:"#/oneOf",keyword:"oneOf",params:{passingSchemas: passing0},message:"must match exactly one schema in oneOf"};if(vErrors === null){vErrors = [err2];}else {vErrors.push(err2);}errors++;validate18.errors = vErrors;return false;}else {errors = _errs0;if(vErrors !== null){if(_errs0){vErrors.length = _errs0;}else {vErrors = null;}}}validate18.errors = vErrors;evaluated0.props = props0;evaluated0.items = items0;return errors === 0;}validate18.evaluated = {"dynamicProps":true,"dynamicItems":true};