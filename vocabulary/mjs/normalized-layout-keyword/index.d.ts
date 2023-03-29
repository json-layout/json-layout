import { type NormalizedLayout } from './types';
export * from './types';
interface ValidateNormalizedLayout {
    errors: any;
    (layoutKeyword: any): layoutKeyword is NormalizedLayout;
}
export declare const validateNormalizedLayout: ValidateNormalizedLayout;
