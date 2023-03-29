import { validateLayoutKeyword, isComponentName, isPartialCompObject, isChildren, isResponsive, isReadWrite } from './layout-keyword';
import { validateNormalizedLayout } from '.';
function getDefaultCompObject(schemaFragment, schemaPath) {
    if (schemaFragment.type === 'object')
        return { comp: 'section' };
    if (schemaFragment.type === 'string')
        return { comp: 'text-field' };
    throw new Error(`failed to calculate default layout for schema ${schemaPath}`);
}
function getPartialCompObject(layoutKeyword) {
    if (isPartialCompObject(layoutKeyword))
        return layoutKeyword;
    else if (isComponentName(layoutKeyword))
        return { comp: layoutKeyword };
    else if (isChildren(layoutKeyword))
        return { children: layoutKeyword };
    return null;
}
function getCompObject(layoutKeyword, defaultCompObject) {
    const partial = getPartialCompObject(layoutKeyword);
    return Object.assign({}, defaultCompObject, partial);
}
function getResponsive(layoutKeyword, defaultCompObject) {
    if (isResponsive(layoutKeyword)) {
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
    if (isReadWrite(layoutKeyword)) {
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
export function normalizeLayoutFragment(schemaFragment, schemaPath) {
    const layoutKeyword = schemaFragment.layout || {};
    if (!validateLayoutKeyword(layoutKeyword)) {
        throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors });
    }
    const defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath);
    const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject);
    if (!validateNormalizedLayout(normalizedLayout)) {
        throw new Error('invalid layout', { cause: validateNormalizedLayout.errors });
    }
    return normalizedLayout;
}
