/**
 * Document Analyzer
 * Analyzes Jyro documents for errors and extracts symbols
 */

import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { getAllFunctionNames, getFunctionSignature } from '../../../shared';

export interface SymbolInfo {
    name: string;
    type?: string;
    line: number;
    character: number;
}

export interface AnalyzerOptions {
    warnOnHostFunctions: boolean;
}

export interface ParamInfo {
    name: string;
    type?: string;
    defaultValue?: string;
}

export interface UserFunctionInfo {
    name: string;
    params: ParamInfo[];
    line: number;
    character: number;
}

export interface UnionInfo {
    name: string;
    variants: Array<{ name: string; fields: ParamInfo[] }>;
    line: number;
}

export interface VariantConstructorInfo {
    variantName: string;
    unionName: string;
    fields: ParamInfo[];
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
        'func', 'union', 'match', 'exit', 'delete'
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
                // Validate default param ordering: required params must precede optional params
                let seenDefault = false;
                for (const param of params) {
                    if (param.defaultValue) {
                        seenDefault = true;
                    } else if (seenDefault) {
                        const paramPos = this.lines[i].indexOf(param.name, this.lines[i].indexOf('('));
                        this.addDiagnostic(
                            i, paramPos >= 0 ? paramPos : 0, i, paramPos >= 0 ? paramPos + param.name.length : 0,
                            `Parameter "${param.name}" without default value must appear before parameters with default values`,
                            DiagnosticSeverity.Error
                        );
                    }
                }

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
                const variants: Array<{ name: string; fields: ParamInfo[] }> = [];

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

    private parseFuncParams(paramStr: string): ParamInfo[] {
        if (!paramStr.trim()) return [];
        return paramStr.split(',').map(p => {
            const trimmed = p.trim();
            const result: ParamInfo = { name: '' };

            // Check for default value (first '=' that isn't ==, =>, !=, +=, -=, *=, /=, %=)
            const eqIndex = this.findDefaultValueSeparator(trimmed);

            let nameAndType: string;
            if (eqIndex >= 0) {
                nameAndType = trimmed.substring(0, eqIndex).trim();
                result.defaultValue = trimmed.substring(eqIndex + 1).trim();
            } else {
                nameAndType = trimmed;
            }

            // Check for type annotation (name: type)
            const colonIndex = nameAndType.indexOf(':');
            if (colonIndex >= 0) {
                result.name = nameAndType.substring(0, colonIndex).trim();
                result.type = nameAndType.substring(colonIndex + 1).trim() || undefined;
            } else {
                result.name = nameAndType;
            }

            return result;
        });
    }

    /**
     * Finds the first '=' in a parameter string that is a default value separator,
     * not part of ==, =>, !=, +=, -=, *=, /=, or %=
     */
    private findDefaultValueSeparator(param: string): number {
        for (let i = 0; i < param.length; i++) {
            if (param[i] === '=') {
                // Skip compound operators: ==, =>
                if (param[i + 1] === '=' || param[i + 1] === '>') continue;
                // Skip operators ending with =: !=, +=, -=, *=, /=, %=
                if (i > 0 && '!+-*/%'.includes(param[i - 1])) continue;
                return i;
            }
        }
        return -1;
    }

    /**
     * Basic syntax checking
     */
    private checkSyntax(): void {
        let blockStack: Array<{ type: string; line: number }> = [];
        let inLoop = 0;
        let inFunc = 0;
        let afterTerminator = false;
        let terminatorExprDepth = 0; // Track unclosed brackets/braces/parens in terminator expression

        this.lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                return;
            }

            // Remove comments and string literals for keyword detection to avoid false positives
            const withoutComments = trimmed.replace(/#.*$/, '');
            const trimmedWithoutStrings = this.removeStringLiterals(withoutComments);

            // Track continuation of a multi-line terminator expression (return/fail/exit with unclosed delimiters)
            if (terminatorExprDepth > 0) {
                terminatorExprDepth += this.countDelimiterBalance(trimmedWithoutStrings);
                if (terminatorExprDepth <= 0) {
                    terminatorExprDepth = 0;
                    afterTerminator = true;
                }
                // This line is part of the terminator expression, not unreachable
                // Continue to other checks but skip the unreachable code check below
            } else {
                // Check for unreachable code after return/fail/exit
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
                    // Check if the expression is complete on this line
                    const balance = this.countDelimiterBalance(trimmedWithoutStrings);
                    if (balance > 0) {
                        // Expression continues on next line(s)
                        terminatorExprDepth = balance;
                    } else {
                        afterTerminator = true;
                    }
                }
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

            // Check for Data access inside functions
            if (inFunc > 0 && /\bData\b/.test(trimmedWithoutStrings)) {
                const dataPattern = /\bData\b/g;
                let dataMatch;
                while ((dataMatch = dataPattern.exec(trimmedWithoutStrings)) !== null) {
                    // Skip if preceded by a dot (e.g. someObj.Data)
                    if (dataMatch.index > 0 && trimmedWithoutStrings[dataMatch.index - 1] === '.') continue;
                    const leadingWhitespace = line.length - line.trimStart().length;
                    const pos = leadingWhitespace + dataMatch.index;
                    this.addDiagnostic(
                        lineIndex, pos, lineIndex, pos + 4,
                        'Data is inaccessible within functions',
                        DiagnosticSeverity.Warning
                    );
                }
            }

            // Check for delete Data (bare) — deleting the entire Data context is not allowed
            if (/^delete\s+Data\s*$/.test(trimmedWithoutStrings)) {
                const deletePos = line.indexOf('delete');
                this.addDiagnostic(
                    lineIndex, deletePos, lineIndex, deletePos + trimmed.length,
                    'The Data context may not be deleted',
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

        // Validate named argument usage in function calls
        this.validateFunctionCalls();

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
     * Validate named argument usage in function calls
     */
    private validateFunctionCalls(): void {
        // Process each line, tracking multi-line calls via paren depth
        let pendingCall: {
            funcName: string;
            argsText: string;
            startLine: number;
            startChar: number;
            parenDepth: number;
        } | null = null;

        for (let lineIndex = 0; lineIndex < this.lines.length; lineIndex++) {
            const line = this.lines[lineIndex];
            const trimmed = line.trim();
            if (trimmed.startsWith('#') || trimmed.length === 0) continue;

            const lineWithoutStrings = this.removeStringLiterals(line);
            const lineWithoutComments = lineWithoutStrings.replace(/#.*$/, '');

            // Continue accumulating a multi-line call
            if (pendingCall) {
                pendingCall.parenDepth += this.countDelimiterBalance(lineWithoutComments);
                pendingCall.argsText += ' ' + lineWithoutComments.trim();
                if (pendingCall.parenDepth <= 0) {
                    // Close paren found — remove trailing ) and validate
                    const closeIdx = pendingCall.argsText.lastIndexOf(')');
                    if (closeIdx >= 0) {
                        pendingCall.argsText = pendingCall.argsText.substring(0, closeIdx);
                    }
                    this.validateCallArgs(pendingCall.funcName, pendingCall.argsText, pendingCall.startLine, pendingCall.startChar);
                    pendingCall = null;
                }
                continue;
            }

            // Find function calls on this line: identifier( or identifier (
            const callPattern = /\b([A-Za-z_]\w*)\s*\(/g;
            let callMatch;

            while ((callMatch = callPattern.exec(lineWithoutComments)) !== null) {
                const funcName = callMatch[1];
                // Skip keywords
                if (this.keywords.includes(funcName) || this.typeKeywords.includes(funcName)) continue;
                // Skip non-function keywords that look like calls (if, while, etc.)
                if (['if', 'while', 'for', 'foreach', 'switch', 'match'].includes(funcName)) continue;

                const openParenPos = lineWithoutComments.indexOf('(', callMatch.index + funcName.length);
                if (openParenPos < 0) continue;

                const closeParenPos = this.findMatchingParen(lineWithoutComments, openParenPos);
                if (closeParenPos >= 0) {
                    // Single-line call
                    const argsText = lineWithoutComments.substring(openParenPos + 1, closeParenPos);
                    const leadingWhitespace = line.length - line.trimStart().length;
                    this.validateCallArgs(funcName, argsText, lineIndex, leadingWhitespace + callMatch.index);
                } else {
                    // Multi-line call — start accumulating
                    const argsText = lineWithoutComments.substring(openParenPos + 1);
                    const depth = this.countDelimiterBalance(lineWithoutComments.substring(openParenPos));
                    const leadingWhitespace = line.length - line.trimStart().length;
                    pendingCall = {
                        funcName,
                        argsText,
                        startLine: lineIndex,
                        startChar: leadingWhitespace + callMatch.index,
                        parenDepth: depth
                    };
                    break; // Don't look for more calls on this line if we're in a multi-line call
                }
            }
        }
    }

    /**
     * Validate the arguments of a single function call
     */
    private validateCallArgs(funcName: string, argsText: string, line: number, char: number): void {
        const parsed = this.parseCallArguments(argsText);
        if (parsed.isEmpty) return;

        // Check for mixing positional and named
        if (parsed.isMixed) {
            this.addDiagnostic(
                line, char, line, char + funcName.length,
                `Cannot mix positional and named arguments in call to "${funcName}"`,
                DiagnosticSeverity.Error
            );
            return; // Don't check further if mixed
        }

        // For positional calls, no named-arg validation needed
        if (parsed.isPositional) return;

        // Named call validation
        const namedArgs = parsed.args.filter(a => a.name);

        // Check for duplicate named args
        const seenNames = new Set<string>();
        for (const arg of namedArgs) {
            if (arg.name && seenNames.has(arg.name)) {
                this.addDiagnostic(
                    line, char, line, char + funcName.length,
                    `Duplicate named argument "${arg.name}" in call to "${funcName}"`,
                    DiagnosticSeverity.Error
                );
            }
            if (arg.name) seenNames.add(arg.name);
        }

        // Look up the function's parameter list
        let params: ParamInfo[] | null = null;

        // Check user functions
        const userFunc = this.userFunctions.get(funcName);
        if (userFunc) {
            params = userFunc.params;
        }

        // Check variant constructors
        if (!params) {
            const variant = this.variantConstructors.get(funcName);
            if (variant) {
                params = variant.fields;
            }
        }

        // Check stdlib functions
        if (!params) {
            const stdlibSig = getFunctionSignature(funcName);
            if (stdlibSig) {
                params = stdlibSig.parameters.map(p => ({
                    name: p.name,
                    type: Array.isArray(p.type) ? p.type.join(' | ') : p.type,
                    defaultValue: p.optional ? 'null' : undefined
                }));
            }
        }

        // For unknown functions (host functions), only duplicate check above applies
        if (!params) return;

        const paramNames = new Set(params.map(p => p.name));

        // Check that all named args match known parameter names
        for (const arg of namedArgs) {
            if (arg.name && !paramNames.has(arg.name)) {
                const expected = params.map(p => p.name).join(', ');
                this.addDiagnostic(
                    line, char, line, char + funcName.length,
                    `Unknown parameter "${arg.name}" for function "${funcName}". Expected: ${expected}`,
                    DiagnosticSeverity.Warning
                );
            }
        }

        // Check that all required (non-defaulted) params are provided
        const providedNames = new Set(namedArgs.map(a => a.name));
        for (const param of params) {
            if (!param.defaultValue && !providedNames.has(param.name)) {
                // For stdlib, check optional flag instead
                const stdlibSig = getFunctionSignature(funcName);
                const stdlibParam = stdlibSig?.parameters.find(p => p.name === param.name);
                if (stdlibParam?.optional) continue;

                this.addDiagnostic(
                    line, char, line, char + funcName.length,
                    `Missing required parameter "${param.name}" in call to "${funcName}"`,
                    DiagnosticSeverity.Error
                );
            }
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
                    const paramName = param.trim().split(':')[0].split('=')[0].trim();
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

        // Build a set of lines that are inside union bodies (variant declarations, not code)
        const unionBodyLines = new Set<number>();
        for (const unionDef of this.unionDefinitions.values()) {
            // Lines between `union Name` and `end` are variant declarations
            for (let j = unionDef.line + 1; j < this.lines.length; j++) {
                const t = this.lines[j].trim();
                if (/^end\b/.test(t)) break;
                unionBodyLines.add(j);
            }
        }

        this.lines.forEach((line, lineIndex) => {
            const trimmed = line.trim();

            // Skip comments and empty lines
            if (trimmed.startsWith('#') || trimmed.length === 0) {
                return;
            }

            // Skip union body lines (variant declarations are not code)
            if (unionBodyLines.has(lineIndex)) {
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
     * Parse function call arguments to detect named argument usage.
     * Returns info about each argument including whether it's a named arg.
     * Named args use colon syntax: FuncName(paramName: value)
     */
    parseCallArguments(argsText: string): {
        isNamed: boolean;
        isPositional: boolean;
        isMixed: boolean;
        isEmpty: boolean;
        args: Array<{ name?: string; valueText: string; nameStart: number; nameEnd: number }>;
    } {
        if (!argsText.trim()) {
            return { isNamed: false, isPositional: false, isMixed: false, isEmpty: true, args: [] };
        }

        // Split on commas at depth 0, respecting strings and nesting
        const segments = this.splitArgsAtDepthZero(argsText);
        const args: Array<{ name?: string; valueText: string; nameStart: number; nameEnd: number }> = [];
        let namedCount = 0;
        let positionalCount = 0;

        for (const seg of segments) {
            const trimmed = seg.text.trim();
            if (!trimmed) continue;

            // Check for named arg pattern: identifier followed by : (not ::)
            // Must be at depth 0 and not part of ternary (no ? before the :)
            const namedMatch = trimmed.match(/^([a-zA-Z_]\w*)\s*:\s*/);
            if (namedMatch) {
                // Ensure this : is not part of a ternary by checking no ? precedes it at depth 0
                const colonPos = trimmed.indexOf(':', namedMatch[1].length);
                const beforeColon = trimmed.substring(0, colonPos);
                const hasTernaryQuestion = this.hasQuestionMarkAtDepthZero(beforeColon);

                if (!hasTernaryQuestion && (colonPos + 1 >= trimmed.length || trimmed[colonPos + 1] !== ':')) {
                    const name = namedMatch[1];
                    const valueText = trimmed.substring(namedMatch[0].length);
                    args.push({
                        name,
                        valueText,
                        nameStart: seg.offset + (seg.text.indexOf(name)),
                        nameEnd: seg.offset + (seg.text.indexOf(name)) + name.length
                    });
                    namedCount++;
                    continue;
                }
            }

            // Positional argument
            args.push({
                valueText: trimmed,
                nameStart: seg.offset,
                nameEnd: seg.offset
            });
            positionalCount++;
        }

        return {
            isNamed: namedCount > 0 && positionalCount === 0,
            isPositional: positionalCount > 0 && namedCount === 0,
            isMixed: namedCount > 0 && positionalCount > 0,
            isEmpty: false,
            args
        };
    }

    /**
     * Split argument text on commas at depth zero (respecting nesting and strings)
     */
    private splitArgsAtDepthZero(text: string): Array<{ text: string; offset: number }> {
        const segments: Array<{ text: string; offset: number }> = [];
        let depth = 0;
        let inString: false | '"' | "'" = false;
        let segStart = 0;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];

            if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
                if (!inString) {
                    inString = char;
                } else if (inString === char) {
                    inString = false;
                }
                continue;
            }

            if (inString) continue;

            if (char === '(' || char === '[' || char === '{') {
                depth++;
            } else if (char === ')' || char === ']' || char === '}') {
                depth--;
            } else if (char === ',' && depth === 0) {
                segments.push({ text: text.substring(segStart, i), offset: segStart });
                segStart = i + 1;
            }
        }

        // Last segment
        if (segStart < text.length) {
            segments.push({ text: text.substring(segStart), offset: segStart });
        }

        return segments;
    }

    /**
     * Check if a string contains a ? at depth zero (for ternary detection)
     */
    private hasQuestionMarkAtDepthZero(text: string): boolean {
        let depth = 0;
        let inString: false | '"' | "'" = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
                if (!inString) inString = char;
                else if (inString === char) inString = false;
                continue;
            }
            if (inString) continue;
            if (char === '(' || char === '[' || char === '{') depth++;
            else if (char === ')' || char === ']' || char === '}') depth--;
            else if (char === '?' && text[i + 1] !== '?' && depth === 0) return true;
        }
        return false;
    }

    /**
     * Collect the character ranges of named argument labels on a line.
     * Used by validateSemantics() to skip named arg identifiers.
     */
    private collectNamedArgRanges(line: string): Array<{ start: number; end: number }> {
        const ranges: Array<{ start: number; end: number }> = [];
        // Find all function call patterns: identifier(...)
        const callPattern = /\b([A-Za-z_]\w*)\s*\(/g;
        let callMatch;

        while ((callMatch = callPattern.exec(line)) !== null) {
            const openParenPos = line.indexOf('(', callMatch.index + callMatch[1].length);
            if (openParenPos < 0) continue;

            // Find matching close paren
            const closeParenPos = this.findMatchingParen(line, openParenPos);
            if (closeParenPos < 0) continue;

            const argsText = line.substring(openParenPos + 1, closeParenPos);
            const parsed = this.parseCallArguments(argsText);

            if (parsed.isNamed || parsed.isMixed) {
                for (const arg of parsed.args) {
                    if (arg.name) {
                        // Offset is relative to argsText, adjust to line position
                        const absStart = openParenPos + 1 + arg.nameStart;
                        const absEnd = openParenPos + 1 + arg.nameEnd;
                        ranges.push({ start: absStart, end: absEnd });
                    }
                }
            }
        }

        return ranges;
    }

    /**
     * Find the matching close paren for an open paren at the given position.
     * Respects nesting and strings.
     */
    private findMatchingParen(text: string, openPos: number): number {
        let depth = 0;
        let inString: false | '"' | "'" = false;

        for (let i = openPos; i < text.length; i++) {
            const char = text[i];
            if ((char === '"' || char === "'") && (i === 0 || text[i - 1] !== '\\')) {
                if (!inString) inString = char;
                else if (inString === char) inString = false;
                continue;
            }
            if (inString) continue;
            if (char === '(') depth++;
            else if (char === ')') {
                depth--;
                if (depth === 0) return i;
            }
        }
        return -1;
    }

    /**
     * Count the net open delimiters on a line (positive = more opens than closes)
     * Used to track multi-line expressions in return/fail/exit values
     */
    private countDelimiterBalance(line: string): number {
        let balance = 0;
        let inString: false | '"' | "'" = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
                if (!inString) {
                    inString = char;
                } else if (inString === char) {
                    inString = false;
                }
                continue;
            }
            if (!inString) {
                if (char === '(' || char === '[' || char === '{') balance++;
                else if (char === ')' || char === ']' || char === '}') balance--;
            }
        }
        return balance;
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
