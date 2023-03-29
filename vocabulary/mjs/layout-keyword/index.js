import validate from './validate';
export * from './types';
export const validateLayoutKeyword = validate;
export function isComponentName(layoutKeyword) {
    return typeof layoutKeyword === 'string';
}
export function isChildren(layoutKeyword) {
    return Array.isArray(layoutKeyword);
}
export function isReadWrite(layoutKeyword) {
    return typeof layoutKeyword === 'object' && (!!layoutKeyword.read || !!layoutKeyword.write);
}
export function isResponsive(layoutKeyword) {
    return typeof layoutKeyword === 'object' && (!!layoutKeyword.xs ||
        !!layoutKeyword.sm ||
        !!layoutKeyword.md ||
        !!layoutKeyword.lg ||
        !!layoutKeyword.wl);
}
export function isPartialCompObject(layoutKeyword) {
    return typeof layoutKeyword === 'object' && !isReadWrite(layoutKeyword) && !isResponsive(layoutKeyword);
}
