import { LayoutKeyword, ComponentName, Children, ReadWrite, Responsive, PartialCompObject } from './types';
export * from './types';
type ValidateLayoutKeyword = {
    errors: any;
    (layoutKeyword: any): layoutKeyword is LayoutKeyword;
};
export declare const validateLayoutKeyword: ValidateLayoutKeyword;
export declare function isComponentName(layoutKeyword: LayoutKeyword): layoutKeyword is ComponentName;
export declare function isChildren(layoutKeyword: LayoutKeyword): layoutKeyword is Children;
export declare function isReadWrite(layoutKeyword: LayoutKeyword): layoutKeyword is ReadWrite;
export declare function isResponsive(layoutKeyword: LayoutKeyword): layoutKeyword is Responsive;
export declare function isPartialCompObject(layoutKeyword: LayoutKeyword): layoutKeyword is PartialCompObject;
