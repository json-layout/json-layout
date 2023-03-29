"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeLayoutFragment = void 0;
const layout_keyword_1 = require("./layout-keyword");
const _1 = require(".");
function getDefaultCompObject(schemaFragment, schemaPath) {
    if (schemaFragment.type === 'object')
        return { comp: 'section' };
    if (schemaFragment.type === 'string')
        return { comp: 'text-field' };
    throw new Error(`failed to calculate default layout for schema ${schemaPath}`);
}
function getPartialCompObject(layoutKeyword) {
    if ((0, layout_keyword_1.isPartialCompObject)(layoutKeyword))
        return layoutKeyword;
    else if ((0, layout_keyword_1.isComponentName)(layoutKeyword))
        return { comp: layoutKeyword };
    else if ((0, layout_keyword_1.isChildren)(layoutKeyword))
        return { children: layoutKeyword };
    return null;
}
function getCompObject(layoutKeyword, defaultCompObject) {
    const partial = getPartialCompObject(layoutKeyword);
    return Object.assign({}, defaultCompObject, partial);
}
function getResponsive(layoutKeyword, defaultCompObject) {
    if ((0, layout_keyword_1.isResponsive)(layoutKeyword)) {
        const xs = getCompObject(layoutKeyword.xs || {}, defaultCompObject);
        const sm = getCompObject(layoutKeyword.sm || {}, xs);
        const md = getCompObject(layoutKeyword.sm || {}, sm);
        const lg = getCompObject(layoutKeyword.sm || {}, md);
        const xl = getCompObject(layoutKeyword.sm || {}, lg);
        return { xs, sm, md, lg, xl };
    }
    else {
        const compObject = getCompObject(layoutKeyword, defaultCompObject);
        return { xs: compObject, sm: compObject, md: compObject, lg: compObject, xl: compObject };
    }
}
function getNormalizedLayout(layoutKeyword, defaultCompObject) {
    if ((0, layout_keyword_1.isReadWrite)(layoutKeyword)) {
        return {
            read: getResponsive(layoutKeyword.read || {}, defaultCompObject),
            write: getResponsive(layoutKeyword.write || {}, defaultCompObject)
        };
    }
    else {
        const responsive = getResponsive(layoutKeyword, defaultCompObject);
        return { read: responsive, write: responsive };
    }
}
function normalizeLayoutFragment(schemaFragment, schemaPath) {
    const layoutKeyword = schemaFragment.layout || {};
    if (!(0, layout_keyword_1.validateLayoutKeyword)(layoutKeyword)) {
        throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: layout_keyword_1.validateLayoutKeyword.errors });
    }
    const defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath);
    const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject);
    if (!(0, _1.validateNormalizedLayout)(normalizedLayout)) {
        throw new Error('invalid layout', { cause: _1.validateNormalizedLayout.errors });
    }
    return normalizedLayout;
}
exports.normalizeLayoutFragment = normalizeLayoutFragment;
