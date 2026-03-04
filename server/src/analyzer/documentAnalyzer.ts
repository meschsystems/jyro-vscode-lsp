/**
 * Document Analyzer
 * Analyzes Jyro documents for errors and extracts symbols
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { getAllFunctionNames } from '../../../shared';

export interface SymbolInfo {
    name: string;
    type?: string;
    line: number;
    character: number;
}

export interface AnalyzerOptions {
    warnOnHostFunctions: boolean;
}

export interface UserFunctionInfo {
    name: string;
    params: Array<{ name: string; type?: string }>;
    line: number;
    character: number;
}

export interface UnionInfo {
    name: string;
    variants: Array<{ name: string; fields: Array<{ name: string; type?: string }> }>;
    line: number;
}

export interface VariantConstructorInfo {
    variantName: string;
    unionName: string;
    fields: Array<{ name: string; type?: string }>;
}

export class DocumentAnalyzer {
    private text: string;
    private uri: string;
    private lines: string[];
    private diagnostics: Diagnostic[] = [];
    private symbols: SymbolInfo[] = [];
    private options: AnalyzerOptions;

    // User-defined declarations (populated by extractDeclarations pre-pass)
    private userFunctions: Map<string, UserFunctionInfo> = new Map();
    private unionDefinitions: Map<string, UnionInfo> = new Map();
    private variantConstructors: Map<string, VariantConstructorInfo> = new Map();
    private declarationsExtracted = false;

    // Keywords and tokens
    private readonly keywords = [
        'var', 'if', 'then', 'else', 'elseif', 'end', 'switch', 'do', 'case', 'default',
        'while', 'for', 'foreach', 'in', 'to', 'downto', 'by', 'return', 'fail', 'break', 'continue',
        'true', 'false', 'null', 'and', 'or', 'not', 'is', 'Data',
        'func', 'union', 'match', 'exit'
    ];

    private readonly typeKeywords = ['number', 'string', 'boolean', 'object', 'array'];
    private readonly functionNames = getAllFunctionNames();

    constructor(text: string, uri: string, options: AnalyzerOptions = { warnOnHostFunctions: true }) {
        this.text = text;
        this.uri = uri;
        this.options = options;
        // Split on \n and remove any trailing \r (Windows line endings)
        this.lines = text.split('\n').map(line => line.replace(/\r$/, ''));
    }

    /**
     * Analyze the document and return diagnostics
     */
    public analyze(): Diagnostic[] {
        this.diagnostics = [];
        this.symbols = [];

        this.extractDeclarations();
        this.checkSyntax();
        this.extractSymbols();
        this.validateSemantics();

        return this.diagnostics;
    }

    /**
     * Get extracted symbols
     */
    public getSymbols(): SymbolInfo[] {
        if (this.symbols.length === 0) {
            this.ensureDeclarations();
            this.extractSymbols();
        }
        return this.symbols;
    }

    /**
     * Get user-defined functions
     */
    public getUserFunctions(): Map<string, UserFunctionInfo> {
        this.ensureDeclarations();
        return this.userFunctions;
    }

    /**
     * Get union definitions
     */
    public getUnionDefinitions(): Map<string, UnionInfo> {
        this.ensureDeclarations();
        return this.unionDefinitions;
    }

    /**
     * Get variant constructors (maps variant name -> info)
     */
    public getVariantConstructors(): Map<string, VariantConstructorInfo> {
        this.ensureDeclarations();
        return this.variantConstructors;
    }

    private ensureDeclarations(): void {
        if (!this.declarationsExtracted) {
            this.extractDeclarations();
        }
    }

    /**
     * Pre-pass: extract all func and union declarations (hoisted)
     */
    private extractDeclarations(): void {
        this.userFunctions.clear();
        this.unionDefinitions.clear();
        this.variantConstructors.clear();
        this.declarationsExtracted = true;

        for (let i = 0; i < this.lines.length; i++) {
            const trimmed = this.lines[i].trim();
            if (trimmed.startsWith('#') || trimmed.length === 0) continue;

            const withoutComments = trimmed.replace(/#.*$/, '');
            const clean = this.removeStringLiterals(withoutComments);

            // Extract func declarations
            const funcMatch = clean.match(/^func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
            if (funcMatch) {
                const funcName = funcMatch[1];
                const params = this.parseFuncParams(funcMatch[2]);
                const charPos = this.lines[i].indexOf(funcName);
                this.userFunctions.set(funcName, {
                    name: funcName,
                    params,
                    line: i,
                    character: charPos
                });
            }

            // Extract union declarations
            const unionMatch = clean.match(/^union\s+([A-Z]\w*)/);
            if (unionMatch) {
                const unionName = unionMatch[1];
                const variants: Array<{ name: string; fields: Array<{ name: string; type?: string }> }> = [];

                let j = i + 1;
                while (j < this.lines.length) {
                    const variantLine = this.lines[j].trim();
                    if (/^end\b/.test(variantLine)) break;
                    if (variantLine.startsWith('#') || variantLine === '') { j++; continue; }

                    const variantClean = this.removeStringLiterals(variantLine.replace(/#.*$/, ''));
                    const variantMatch = variantClean.match(/^([A-Z]\w*)\s*\(([^)]*)\)/);
                    if (variantMatch) {
                        const variantName = variantMatch[1];
                        const fields = this.parseFuncParams(variantMatch[2]);
                        variants.push({ name: variantName, fields });
                        this.variantConstructors.set(variantName, {
                            variantName,
                            unionName,
                            fields
                        });
                    }
                    j++;
                }

                this.unionDefinitions.set(unionName, {
                    name: unionName,
                    variants,
                    line: i
                });
            }
        }
    }

    private parseFuncParams(paramStr: string): Array<{ name: string; type?: string }> {
        if (!paramStr.trim()) return [];
        return paramStr.split(',').map(p => {
            const parts = p.trim().split(':').map(s => s.trim());
            return { name: parts[0], type: parts[1] || undefined };
        });
    }

    /**
     * Basic syntax checking
     */
    private checkSyntax(): void {
        let blockStack: Array<{ type: string; line: number }> = [];
        let inLoop = 0;
        let inFunc = 0;
        let afterTerminator = false;

        this.lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                return;
            }

            // Remove comments and string literals for keyword detection to avoid false positives
            const withoutComments = trimmed.replace(/#.*$/, '');
            const trimmedWithoutStrings = this.removeStringLiterals(withoutComments);

            // Check for unreachable code after return/fail
            const isBlockBoundary = /^(end|else|elseif|case|default)\b/.test(trimmedWithoutStrings);
            if (afterTerminator && !isBlockBoundary) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, trimmed.length,
                    'Unreachable code detected',
                    DiagnosticSeverity.Warning
                );
            }
            if (isBlockBoundary) {
                afterTerminator = false;
            } else if (/^(return|fail|exit)\b/.test(trimmedWithoutStrings)) {
                afterTerminator = true;
            }

            // Check for unclosed strings (properly handling escaped quotes)
            if (!this.hasBalancedStrings(line)) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, line.length,
                    'Unclosed string literal',
                    DiagnosticSeverity.Error
                );
            }

            // Check for unmatched brackets/parentheses/braces
            const openParen = (line.match(/\(/g) || []).length;
            const closeParen = (line.match(/\)/g) || []).length;
            const openBrace = (line.match(/\{/g) || []).length;
            const closeBrace = (line.match(/\}/g) || []).length;
            const openBracket = (line.match(/\[/g) || []).length;
            const closeBracket = (line.match(/\]/g) || []).length;

            // Check block structure (elseif is a continuation, not a new block)
            // Note: case/default do NOT get their own 'end' — only switch does
            const startsWithElseif = /^\s*elseif\b/i.test(trimmed);
            if (!startsWithElseif && /\b(if|while|for|foreach|switch|func|union|match)\b/.test(trimmedWithoutStrings)) {
                const match = trimmedWithoutStrings.match(/\b(if|while|for|foreach|switch|func|union|match)\b/);
                if (match) {
                    blockStack.push({ type: match[1], line: lineIndex });
                    if (match[1] === 'while' || match[1] === 'foreach' || match[1] === 'for') {
                        inLoop++;
                    }
                    if (match[1] === 'func') {
                        inFunc++;
                    }
                }
            }

            // Validate func/union must be at top level
            if (/^func\b/.test(trimmedWithoutStrings) && blockStack.length > 1) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, trimmed.length,
                    'Function declarations must be at the top level of the script',
                    DiagnosticSeverity.Error
                );
            }
            if (/^union\b/.test(trimmedWithoutStrings) && blockStack.length > 1) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, trimmed.length,
                    'Union declarations must be at the top level of the script',
                    DiagnosticSeverity.Error
                );
            }

            if (/\bend\b/.test(trimmedWithoutStrings)) {
                if (blockStack.length === 0) {
                    this.addDiagnostic(
                        lineIndex, 0, lineIndex, trimmed.length,
                        'Unexpected "end" without matching block start',
                        DiagnosticSeverity.Error
                    );
                } else {
                    const block = blockStack.pop()!;
                    if (block.type === 'while' || block.type === 'foreach' || block.type === 'for') {
                        inLoop--;
                    }
                    if (block.type === 'func') {
                        inFunc--;
                    }
                }
            }

            // Check for break/continue outside loops
            if (/\b(break|continue)\b/.test(trimmedWithoutStrings) && inLoop === 0) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, trimmed.length,
                    `"${trimmedWithoutStrings.includes('break') ? 'break' : 'continue'}" can only be used inside loops`,
                    DiagnosticSeverity.Error
                );
            }

            // Check for return outside functions
            if (/\breturn\b/.test(trimmedWithoutStrings) && inFunc === 0) {
                this.addDiagnostic(
                    lineIndex, 0, lineIndex, trimmed.length,
                    '"return" can only be used inside functions. Use "exit" for script termination.',
                    DiagnosticSeverity.Error
                );
            }

            // Check for invalid for-loop step values (by 0 or negative)
            const stepMatch = trimmedWithoutStrings.match(/\bby\s+(-?\d+(?:\.\d+)?)\b/);
            if (stepMatch) {
                const stepValue = parseFloat(stepMatch[1]);
                if (stepValue <= 0) {
                    const stepPos = line.indexOf(stepMatch[0]);
                    const valueStart = stepPos + stepMatch[0].indexOf(stepMatch[1]);
                    this.addDiagnostic(
                        lineIndex, valueStart, lineIndex, valueStart + stepMatch[1].length,
                        'For loop step must be a positive number',
                        DiagnosticSeverity.Error
                    );
                }
            }

            // Check for invalid Sleep() argument (non-positive literal)
            const sleepMatch = trimmedWithoutStrings.match(/\bSleep\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/);
            if (sleepMatch) {
                const sleepValue = parseFloat(sleepMatch[1]);
                if (sleepValue <= 0) {
                    const sleepPos = line.indexOf(sleepMatch[0]);
                    const valueStart = sleepPos + sleepMatch[0].indexOf(sleepMatch[1]);
                    this.addDiagnostic(
                        lineIndex, valueStart, lineIndex, valueStart + sleepMatch[1].length,
                        'Sleep() requires a positive integer millisecond value',
                        DiagnosticSeverity.Error
                    );
                }
            }

            // Check for invalid type annotations (only in var declarations)
            // Pattern: var name: type - must start with 'var' to be a type annotation
            if (/^\s*var\s+/.test(trimmed)) {
                const typeAnnotMatch = trimmed.match(/^var\s+\w+\s*:\s*(\w+)/);
                if (typeAnnotMatch && !this.typeKeywords.includes(typeAnnotMatch[1])) {
                    const pos = line.indexOf(typeAnnotMatch[1]);
                    this.addDiagnostic(
                        lineIndex, pos, lineIndex, pos + typeAnnotMatch[1].length,
                        `Unknown type "${typeAnnotMatch[1]}". Expected: number, string, boolean, object, or array`,
                        DiagnosticSeverity.Error
                    );
                }
            }

            // Check for common operator errors
            if (/=[^=]/.test(trimmed) && /==/.test(trimmed)) {
                // Mix of = and ==, might be confusing but not necessarily an error
            }

            // Check for undefined functions (basic check)
            // PascalCase functions not in stdlib are likely host-provided, so show as Information
            // Pattern: any PascalCase identifier (starts with uppercase) followed by opening paren
            if (this.options.warnOnHostFunctions) {
                const funcCallPattern = /\b([A-Z][a-zA-Z0-9]*)\s*\(/g;
                let funcMatch;
                while ((funcMatch = funcCallPattern.exec(trimmedWithoutStrings)) !== null) {
                    const funcName = funcMatch[1];
                    // Skip keywords that happen to be PascalCase (like Data)
                    if (this.keywords.includes(funcName)) {
                        continue;
                    }
                    // Skip user-defined functions and variant constructors
                    if (this.userFunctions.has(funcName)) {
                        continue;
                    }
                    if (this.variantConstructors.has(funcName)) {
                        continue;
                    }
                    if (!this.functionNames.includes(funcName)) {
                        // Calculate correct position: leading whitespace + match position in trimmed
                        const leadingWhitespace = line.length - line.trimStart().length;
                        const pos = leadingWhitespace + funcMatch.index;
                        this.addDiagnostic(
                            lineIndex, pos, lineIndex, pos + funcName.length,
                            `Referenced function "${funcName}" will need to be made available at runtime`,
                            DiagnosticSeverity.Information
                        );
                    }
                }
            }
        });

        // Check for unclosed blocks
        if (blockStack.length > 0) {
            const unclosed = blockStack[blockStack.length - 1];
            this.addDiagnostic(
                unclosed.line, 0, unclosed.line, this.lines[unclosed.line].length,
                `Unclosed "${unclosed.type}" block - missing "end"`,
                DiagnosticSeverity.Error
            );
        }
    }

    /**
     * Extract variable declarations and other symbols
     */
    private extractSymbols(): void {
        const seenProps = new Set<string>();  // Track property assignments across entire document

        // Add user-defined function declarations as symbols
        for (const [, funcInfo] of this.userFunctions) {
            this.symbols.push({
                name: funcInfo.name,
                type: 'function',
                line: funcInfo.line,
                character: funcInfo.character
            });
        }

        // Add union definitions and variant constructors as symbols
        for (const [, unionInfo] of this.unionDefinitions) {
            this.symbols.push({
                name: unionInfo.name,
                type: 'union',
                line: unionInfo.line,
                character: this.lines[unionInfo.line].indexOf(unionInfo.name)
            });
            for (const variant of unionInfo.variants) {
                this.symbols.push({
                    name: variant.name,
                    type: 'constructor',
                    line: unionInfo.line,
                    character: 0
                });
            }
        }

        this.lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                return;
            }

            // Extract ALL variable declarations on the line (can be multiple or mid-line)
            const varPattern = /\bvar\s+(\w+)(?:\s*:\s*(\w+))?/g;
            let varMatch;
            while ((varMatch = varPattern.exec(trimmed)) !== null) {
                const varName = varMatch[1];
                const varType = varMatch[2];
                const pos = line.indexOf(varName, varMatch.index);

                this.symbols.push({
                    name: varName,
                    type: varType,
                    line: lineIndex,
                    character: pos
                });
            }

            // Extract foreach variables
            const foreachMatch = trimmed.match(/\bforeach\s+(\w+)\s+in\b/);
            if (foreachMatch) {
                const varName = foreachMatch[1];
                const pos = line.indexOf(varName);

                this.symbols.push({
                    name: varName,
                    type: 'iterator',
                    line: lineIndex,
                    character: pos
                });
            }

            // Extract for loop variables
            const forMatch = trimmed.match(/\bfor\s+(\w+)\s+in\b/);
            if (forMatch) {
                const varName = forMatch[1];
                const pos = line.indexOf(varName, forMatch.index);

                this.symbols.push({
                    name: varName,
                    type: 'iterator',
                    line: lineIndex,
                    character: pos
                });
            }

            // Extract lambda parameters: (x, y) => ... or p => ...
            const parenLambdaPattern = /\(([^)]*)\)\s*=>/g;
            let lambdaMatch;
            while ((lambdaMatch = parenLambdaPattern.exec(trimmed)) !== null) {
                const params = lambdaMatch[1].split(',');
                for (const param of params) {
                    const paramName = param.trim();
                    if (paramName && /^\w+$/.test(paramName)) {
                        this.symbols.push({
                            name: paramName,
                            type: 'lambda-param',
                            line: lineIndex,
                            character: line.indexOf(paramName, lambdaMatch.index)
                        });
                    }
                }
            }

            const bareLambdaPattern = /\b(\w+)\s*=>/g;
            let bareMatch;
            while ((bareMatch = bareLambdaPattern.exec(trimmed)) !== null) {
                const paramName = bareMatch[1];
                // Avoid duplicates from the parenthesized pattern
                if (!this.symbols.some(s => s.name === paramName && s.line === lineIndex && s.type === 'lambda-param')) {
                    this.symbols.push({
                        name: paramName,
                        type: 'lambda-param',
                        line: lineIndex,
                        character: line.indexOf(paramName, bareMatch.index)
                    });
                }
            }

            // Extract property assignments (first assignment is the definition)
            // Pattern: identifier.property = (captures the full path like Data.orders)
            const propAssignPattern = /\b([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)+)\s*=/g;
            let propMatch;
            while ((propMatch = propAssignPattern.exec(trimmed)) !== null) {
                const propPath = propMatch[1];  // e.g., "Data.orders"

                // Only track first assignment as the definition
                if (!seenProps.has(propPath)) {
                    seenProps.add(propPath);
                    const pos = line.indexOf(propPath);

                    this.symbols.push({
                        name: propPath,
                        type: 'property',
                        line: lineIndex,
                        character: pos
                    });
                }
            }

            // Extract func parameter names (scoped to the function body)
            const funcParamMatch = trimmed.match(/^func\s+[A-Za-z_]\w*\s*\(([^)]*)\)/);
            if (funcParamMatch && funcParamMatch[1].trim()) {
                const params = funcParamMatch[1].split(',');
                for (const param of params) {
                    const paramName = param.trim().split(':')[0].trim();
                    if (paramName && /^\w+$/.test(paramName)) {
                        this.symbols.push({
                            name: paramName,
                            type: 'parameter',
                            line: lineIndex,
                            character: line.indexOf(paramName)
                        });
                    }
                }
            }

            // Extract match case bindings: case VariantName(a, b) then
            const matchCasePattern = /\bcase\s+[A-Z]\w*\s*\(([^)]+)\)\s+then/g;
            let matchCaseMatch;
            while ((matchCaseMatch = matchCasePattern.exec(trimmed)) !== null) {
                const bindingsStr = matchCaseMatch[1];
                const bindings = bindingsStr.split(',').map(b => b.trim());
                for (const binding of bindings) {
                    if (binding && /^\w+$/.test(binding)) {
                        this.symbols.push({
                            name: binding,
                            type: 'match-binding',
                            line: lineIndex,
                            character: line.indexOf(binding, matchCaseMatch.index)
                        });
                    }
                }
            }
        });
    }

    /**
     * Validate semantics (undefined variables, etc.)
     */
    private validateSemantics(): void {
        const declaredVars = new Set<string>(this.symbols.map(s => s.name));
        declaredVars.add('Data'); // Data is always available
        // Add user function names and variant constructor names
        for (const funcName of this.userFunctions.keys()) {
            declaredVars.add(funcName);
        }
        for (const variantName of this.variantConstructors.keys()) {
            declaredVars.add(variantName);
        }

        this.lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                return;
            }

            // Remove string literals from the line before checking for variables
            // This prevents false positives for identifiers inside strings like "orderId"
            const lineWithoutStrings = this.removeStringLiterals(line);

            // Remove inline comments (everything after # when not in a string)
            const lineWithoutComments = lineWithoutStrings.replace(/#.*$/, '');

            // Find variable usage (simple pattern matching)
            // This is a basic implementation - a full solution would use the parser
            const varPattern = /\b([a-zA-Z_]\w*)\b/g;
            let match;
            while ((match = varPattern.exec(lineWithoutComments)) !== null) {
                const varName = match[1];
                const pos = match.index;
                const endPos = pos + varName.length;

                // Skip property access (identifiers after a dot)
                // In Jyro, any property can be auto-added to objects
                if (pos > 0 && lineWithoutComments[pos - 1] === '.') {
                    continue;
                }

                // Skip function calls (identifier followed by parenthesis)
                // PascalCase function calls are handled separately with Information severity in checkSyntax
                const afterIdent = lineWithoutComments.substring(endPos).match(/^\s*\(/);
                if (afterIdent) {
                    continue;
                }

                // Skip object literal keys (identifier followed by colon, not ::)
                // Pattern: { key: value } — the key is not a variable reference
                const afterKey = lineWithoutComments.substring(endPos).match(/^\s*:/);
                if (afterKey && lineWithoutComments[endPos + afterKey[0].length] !== ':') {
                    continue;
                }

                // Skip keywords and function names
                if (this.keywords.includes(varName) ||
                    this.typeKeywords.includes(varName) ||
                    this.functionNames.some((f: string) => f.toLowerCase() === varName.toLowerCase())) {
                    continue;
                }

                // Check if variable is declared
                if (!declaredVars.has(varName)) {
                    this.addDiagnostic(
                        lineIndex, pos, lineIndex, pos + varName.length,
                        `Undefined variable "${varName}"`,
                        DiagnosticSeverity.Warning
                    );
                }
            }
        });
    }

    /**
     * Check if a line has balanced string literals (properly handling escaped quotes)
     */
    private hasBalancedStrings(line: string): boolean {
        let inString: false | '"' | "'" = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
                // Check if this quote is escaped
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && line[j] === '\\') {
                    backslashCount++;
                    j--;
                }
                // Quote is escaped only if preceded by an odd number of backslashes
                if (backslashCount % 2 === 0) {
                    if (!inString) {
                        inString = char;
                    } else if (inString === char) {
                        inString = false;
                    }
                }
            }
        }
        return !inString;
    }

    /**
     * Remove string literals from a line (properly handling escaped quotes)
     * Replaces each string with "" to preserve structure for pattern matching
     */
    private removeStringLiterals(line: string): string {
        let result = '';
        let inString: false | '"' | "'" = false;
        let stringStart = -1;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' || char === "'") {
                // Check if this quote is escaped
                let backslashCount = 0;
                let j = i - 1;
                while (j >= 0 && line[j] === '\\') {
                    backslashCount++;
                    j--;
                }
                // Quote is escaped only if preceded by an odd number of backslashes
                if (backslashCount % 2 === 0) {
                    if (!inString) {
                        inString = char;
                        stringStart = i;
                    } else if (inString === char) {
                        // End of string - replace content with empty string
                        result += '""';
                        inString = false;
                    }
                }
            } else if (!inString) {
                result += char;
            }
        }

        // If we're still in a string at the end, include remaining content
        if (inString) {
            result += line.substring(stringStart);
        }

        return result;
    }

    /**
     * Add a diagnostic
     */
    private addDiagnostic(
        startLine: number,
        startChar: number,
        endLine: number,
        endChar: number,
        message: string,
        severity: DiagnosticSeverity
    ): void {
        this.diagnostics.push({
            severity,
            range: {
                start: { line: startLine, character: startChar },
                end: { line: endLine, character: endChar }
            },
            message,
            source: 'jyro'
        });
    }
}
