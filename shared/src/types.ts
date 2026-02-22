/**
 * Shared type definitions for the Jyro language
 */

/**
 * Jyro value types
 */
export enum JyroType {
    Null = 'null',
    Number = 'number',
    String = 'string',
    Boolean = 'boolean',
    Object = 'object',
    Array = 'array'
}

/**
 * Symbol kinds in Jyro
 */
export enum SymbolKind {
    Variable = 'variable',
    Function = 'function',
    Parameter = 'parameter',
    Property = 'property'
}

/**
 * Symbol information
 */
export interface Symbol {
    name: string;
    kind: SymbolKind;
    type?: JyroType;
    location: Location;
    scope: string;
}

/**
 * Location in source code
 */
export interface Location {
    uri: string;
    range: Range;
}

/**
 * Range in source code
 */
export interface Range {
    start: Position;
    end: Position;
}

/**
 * Position in source code
 */
export interface Position {
    line: number;
    character: number;
}

/**
 * Diagnostic severity
 */
export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

/**
 * Diagnostic message
 */
export interface Diagnostic {
    range: Range;
    severity: DiagnosticSeverity;
    message: string;
    code?: string | number;
}
