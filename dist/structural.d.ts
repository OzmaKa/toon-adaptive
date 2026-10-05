import { StructuralAnalysis } from "./types";
type JsonValue = null | boolean | number | string | JsonValue[] | {
    [key: string]: JsonValue;
};
export declare function analyzeStructure(payload: JsonValue): StructuralAnalysis;
export {};
