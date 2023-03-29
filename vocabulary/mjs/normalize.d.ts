import { type LayoutKeyword } from './layout-keyword';
import { type NormalizedLayout } from '.';
export interface SchemaFragment {
    layout?: LayoutKeyword;
    type: string;
    properties?: Record<string, any>;
    oneOf?: any[];
    anyOf?: any[];
    allOf?: any[];
}
export declare function normalizeLayoutFragment(schemaFragment: SchemaFragment, schemaPath: string): NormalizedLayout;
