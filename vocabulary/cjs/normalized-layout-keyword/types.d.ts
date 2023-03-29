/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "comp-object".
 */
export type CompObject = Section | TextField | Textarea | Checkbox;
export interface NormalizedLayout {
    read: NormalizedResponsive;
    write: NormalizedResponsive;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "normalized-responsive".
 */
export interface NormalizedResponsive {
    xs: CompObject;
    sm: CompObject;
    md: CompObject;
    lg: CompObject;
    xl: CompObject;
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "section".
 */
export interface Section {
    comp?: "section";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "text-field".
 */
export interface TextField {
    comp?: "text-field";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "textarea".
 */
export interface Textarea {
    comp?: "textarea";
}
/**
 * This interface was referenced by `NormalizedLayout`'s JSON-Schema
 * via the `definition` "checkbox".
 */
export interface Checkbox {
    comp?: "checkbox";
}
export declare const normalizedLayoutKeywordSchema: {
    $id: string;
    title: string;
    type: string;
    additionalProperties: boolean;
    required: string[];
    properties: {
        read: {
            $ref: string;
        };
        write: {
            $ref: string;
        };
    };
    $defs: {
        "normalized-responsive": {
            type: string;
            additionalProperties: boolean;
            required: string[];
            properties: {
                xs: {
                    $ref: string;
                };
                sm: {
                    $ref: string;
                };
                md: {
                    $ref: string;
                };
                lg: {
                    $ref: string;
                };
                xl: {
                    $ref: string;
                };
            };
        };
        "comp-object": {
            type: string;
            discriminator: {
                propertyName: string;
            };
            required: string[];
            oneOf: {
                $ref: string;
            }[];
        };
        section: {
            type: string;
            additionalProperties: boolean;
            properties: {
                comp: {
                    const: string;
                };
            };
        };
        "text-field": {
            type: string;
            additionalProperties: boolean;
            properties: {
                comp: {
                    const: string;
                };
            };
        };
        textarea: {
            type: string;
            additionalProperties: boolean;
            properties: {
                comp: {
                    const: string;
                };
            };
        };
        checkbox: {
            type: string;
            additionalProperties: boolean;
            properties: {
                comp: {
                    const: string;
                };
            };
        };
    };
};
