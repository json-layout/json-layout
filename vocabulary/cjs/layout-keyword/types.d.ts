export type LayoutKeyword = ComponentName | Children | PartialCompObject | Responsive | ReadWrite;
export type ComponentName = "text-field" | "textarea" | "checkbox";
export type Children = string[];
export type Responsive = Responsive1 & {
    /**
     * < 600px
     */
    xs?: ComponentName | Children | PartialCompObject;
    /**
     * >= 600px, < 960
     */
    sm?: ComponentName | Children | PartialCompObject;
    /**
     * >= 960px, < 1264
     */
    md?: ComponentName | Children | PartialCompObject;
    /**
     * >= 1264px, < 1904
     */
    lg?: ComponentName | Children | PartialCompObject;
    /**
     * >= 1904
     */
    xl?: ComponentName | Children | PartialCompObject;
};
export type Responsive1 = {
    [k: string]: unknown;
};
export type ReadWrite = ReadWrite1 & {
    /**
     * apply this layout if data is rendered read only
     */
    read?: ComponentName | Children | PartialCompObject | Responsive1;
    /**
     * apply this layout if data is rendered for writes
     */
    write?: ComponentName | Children | PartialCompObject | Responsive1;
};
export type ReadWrite1 = {
    [k: string]: unknown;
};
export interface PartialCompObject {
    comp?: ComponentName;
    children?: Children;
}
export declare const layoutKeywordSchema: {
    $id: string;
    title: string;
    oneOf: {
        $ref: string;
    }[];
    $defs: {
        comp: {
            title: string;
            type: string;
            enum: string[];
        };
        children: {
            type: string;
            items: {
                type: string;
            };
        };
        partial: {
            title: string;
            type: string;
            additionalProperties: boolean;
            properties: {
                comp: {
                    $ref: string;
                };
                children: {
                    $ref: string;
                };
            };
        };
        responsive: {
            type: string;
            additionalProperties: boolean;
            properties: {
                xs: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
                sm: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
                md: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
                lg: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
                xl: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
            };
            anyOf: {
                required: string[];
            }[];
        };
        "read-write": {
            type: string;
            additionalProperties: boolean;
            properties: {
                read: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
                write: {
                    description: string;
                    oneOf: {
                        $ref: string;
                    }[];
                };
            };
            anyOf: {
                required: string[];
            }[];
        };
    };
};
