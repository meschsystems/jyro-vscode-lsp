/**
 * Jyro Language Server
 * Implements the Language Server Protocol for Jyro scripting language
 */

import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    HoverParams,
    Hover,
    SignatureHelpParams,
    SignatureHelp,
    DefinitionParams,
    Definition,
    DocumentSymbolParams,
    SymbolInformation,
    SymbolKind as LSPSymbolKind,
    DocumentFormattingParams,
    TextEdit,
    Range
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { STDLIB_FUNCTIONS, getFunctionSignature, getAllFunctionNames, FunctionSignature, FunctionParameter } from '../../shared';
import { DocumentAnalyzer } from './analyzer/documentAnalyzer';

// Create a connection for the server using Node's IPC
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Settings interface
interface JyroSettings {
    maxNumberOfProblems: number;
    warnOnHostFunctions: boolean;
    trace: {
        server: string;
    };
}

// Default settings
const defaultSettings: JyroSettings = {
    maxNumberOfProblems: 100,
    warnOnHostFunctions: true,
    trace: { server: 'off' }
};
let globalSettings: JyroSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<JyroSettings>> = new Map();

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    connection.console.log('Jyro Language Server initializing...');
    const capabilities = params.capabilities;

    // Check client capabilities
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: ['.', '(']
            },
            hoverProvider: true,
            signatureHelpProvider: {
                triggerCharacters: ['(', ',']
            },
            definitionProvider: true,
            documentFormattingProvider: true
        }
    };

    if (hasWorkspaceFolderCapability) {
        result.capabilities.workspace = {
            workspaceFolders: {
                supported: true
            }
        };
    }

    connection.console.log('Server capabilities: ' + JSON.stringify(result.capabilities));
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders(_event => {
            connection.console.log('Workspace folder change event received.');
        });
    }
});

connection.onDidChangeConfiguration(change => {
    if (hasConfigurationCapability) {
        // Reset all cached document settings
        documentSettings.clear();
    } else {
        globalSettings = <JyroSettings>(
            (change.settings.jyro || defaultSettings)
        );
    }

    // Revalidate all open text documents
    documents.all().forEach(validateTextDocument);
});

function getDocumentSettings(resource: string): Thenable<JyroSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'jyro'
        });
        documentSettings.set(resource, result);
    }
    return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
    documentSettings.delete(e.document.uri);
});

// The content of a text document has changed
documents.onDidChangeContent(change => {
    validateTextDocument(change.document);
});

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    const text = textDocument.getText();

    const analyzer = new DocumentAnalyzer(text, textDocument.uri, {
        warnOnHostFunctions: settings.warnOnHostFunctions
    });
    const diagnostics = analyzer.analyze();

    // Limit the number of problems
    const limitedDiagnostics = diagnostics.slice(0, settings.maxNumberOfProblems);

    // Send the computed diagnostics to VSCode
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: limitedDiagnostics });
}

// This handler provides completion items
connection.onCompletion(
    (_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
        const document = documents.get(_textDocumentPosition.textDocument.uri);
        if (!document) {
            return [];
        }

        const text = document.getText();
        const offset = document.offsetAt(_textDocumentPosition.position);
        const line = _textDocumentPosition.position.line;
        const lineText = document.getText({
            start: { line, character: 0 },
            end: { line, character: Number.MAX_SAFE_INTEGER }
        });

        const completions: CompletionItem[] = [];

        // Keywords
        const keywords = [
            'var', 'if', 'then', 'else', 'elseif', 'end', 'switch', 'do', 'case', 'default',
            'while', 'for', 'foreach', 'in', 'to', 'downto', 'by', 'return', 'fail', 'break', 'continue',
            'true', 'false', 'null', 'and', 'or', 'not', 'is'
        ];

        keywords.forEach(keyword => {
            completions.push({
                label: keyword,
                kind: CompletionItemKind.Keyword,
                data: { type: 'keyword', value: keyword }
            });
        });

        // Type keywords
        const types = ['number', 'string', 'boolean', 'object', 'array'];
        types.forEach(type => {
            completions.push({
                label: type,
                kind: CompletionItemKind.TypeParameter,
                data: { type: 'type', value: type }
            });
        });

        // Standard library functions
        STDLIB_FUNCTIONS.forEach((func: FunctionSignature) => {
            const params = func.parameters.map((p: FunctionParameter) => p.name).join(', ');
            completions.push({
                label: func.name,
                kind: CompletionItemKind.Function,
                detail: `${func.name}(${params})`,
                documentation: func.description,
                insertText: `${func.name}($1)`,
                insertTextFormat: 2, // Snippet
                data: { type: 'function', signature: func }
            });
        });

        // Data keyword
        completions.push({
            label: 'Data',
            kind: CompletionItemKind.Variable,
            detail: 'Root data object',
            documentation: 'The root data object for accessing input data',
            data: { type: 'data' }
        });

        // Analyze document for variable completions
        const analyzer = new DocumentAnalyzer(text, document.uri);
        const symbols = analyzer.getSymbols();
        symbols.forEach(symbol => {
            completions.push({
                label: symbol.name,
                kind: CompletionItemKind.Variable,
                detail: symbol.type || 'unknown',
                data: { type: 'variable', symbol }
            });
        });

        return completions;
    }
);

// This handler resolves additional information for completion items
connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        if (item.data && item.data.type === 'function') {
            const sig: typeof STDLIB_FUNCTIONS[0] = item.data.signature;
            item.documentation = {
                kind: 'markdown',
                value: [
                    `**${sig.name}** - ${sig.category}`,
                    '',
                    sig.description,
                    '',
                    '**Parameters:**',
                    ...sig.parameters.map((p: FunctionParameter) => `- \`${p.name}\` (${Array.isArray(p.type) ? p.type.join(' | ') : p.type}): ${p.description}`),
                    '',
                    '**Returns:** ' + (Array.isArray(sig.returnType) ? sig.returnType.join(' | ') : sig.returnType),
                    ...(sig.examples ? ['', '**Examples:**', ...sig.examples.map((e: string) => `\`\`\`jyro\n${e}\n\`\`\``)] : [])
                ].join('\n')
            };
        }
        return item;
    }
);

// Hover provider
connection.onHover((params: HoverParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    const text = document.getText();
    const offset = document.offsetAt(params.position);

    // Get word at position
    const wordRange = getWordRangeAtPosition(document, params.position);
    if (!wordRange) {
        return null;
    }

    const word = document.getText(wordRange);

    // Check if it's a function
    const funcSig = getFunctionSignature(word);
    if (funcSig) {
        const params = funcSig.parameters.map((p: FunctionParameter) =>
            `${p.name}: ${Array.isArray(p.type) ? p.type.join(' | ') : p.type}`
        ).join(', ');

        return {
            contents: {
                kind: 'markdown',
                value: [
                    `**${funcSig.name}**(${params})`,
                    '',
                    funcSig.description,
                    '',
                    `*Category: ${funcSig.category}*`,
                    '',
                    '**Returns:** ' + (Array.isArray(funcSig.returnType) ? funcSig.returnType.join(' | ') : funcSig.returnType),
                    ...(funcSig.examples ? ['', '**Example:**', `\`\`\`jyro\n${funcSig.examples[0]}\n\`\`\``] : [])
                ].join('\n')
            },
            range: wordRange
        };
    }

    // Check if it's a keyword
    const keywords = [
        { word: 'var', desc: 'Variable declaration keyword' },
        { word: 'if', desc: 'Conditional statement' },
        { word: 'then', desc: 'Used after condition in if/case statements' },
        { word: 'else', desc: 'Alternative branch in conditional' },
        { word: 'elseif', desc: 'Alternative conditional branch (else if combined)' },
        { word: 'end', desc: 'Ends a block (if/while/for/foreach/switch)' },
        { word: 'while', desc: 'While loop statement' },
        { word: 'do', desc: 'Marks the start of a loop/switch body' },
        { word: 'for', desc: 'Range-based for loop: for i in 0 to 10 do ... end' },
        { word: 'foreach', desc: 'Foreach loop for iterating arrays/objects/strings' },
        { word: 'in', desc: 'Separates loop variable from range/collection' },
        { word: 'to', desc: 'Defines ascending upper bound in a for loop range (exclusive)' },
        { word: 'downto', desc: 'Defines descending lower bound in a for loop range (exclusive)' },
        { word: 'by', desc: 'Defines the step size in a for loop range' },
        { word: 'switch', desc: 'Switch statement for multiple conditions' },
        { word: 'case', desc: 'Case block in switch statement. Supports multiple values: case val1, val2 then ...' },
        { word: 'default', desc: 'Default case block in switch statement: default then ...' },
        { word: 'break', desc: 'Exits the current loop' },
        { word: 'continue', desc: 'Skips to the next iteration of the loop' },
        { word: 'return', desc: 'Returns from the script with an optional value' },
        { word: 'fail', desc: 'Terminates script execution with an error. Can include an optional message.' },
        { word: 'Data', desc: 'The shared data context between the script and its host' }
    ];

    const keyword = keywords.find(k => k.word === word);
    if (keyword) {
        return {
            contents: {
                kind: 'markdown',
                value: `**${keyword.word}**\n\n${keyword.desc}`
            },
            range: wordRange
        };
    }

    return null;
});

// Signature help provider
connection.onSignatureHelp((params: SignatureHelpParams): SignatureHelp | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    // Get function name at current position
    const text = document.getText();
    const offset = document.offsetAt(params.position);

    // Find the function call we're in
    let parenDepth = 0;
    let funcStart = -1;
    for (let i = offset - 1; i >= 0; i--) {
        if (text[i] === ')') parenDepth++;
        else if (text[i] === '(') {
            if (parenDepth === 0) {
                funcStart = i;
                break;
            }
            parenDepth--;
        }
    }

    if (funcStart === -1) {
        return null;
    }

    // Get function name
    const beforeParen = text.substring(0, funcStart).trim();
    const funcNameMatch = beforeParen.match(/(\w+)\s*$/);
    if (!funcNameMatch) {
        return null;
    }

    const funcName = funcNameMatch[1];
    const funcSig = getFunctionSignature(funcName);
    if (!funcSig) {
        return null;
    }

    // Count which parameter we're on
    const callText = text.substring(funcStart + 1, offset);
    const commaCount = (callText.match(/,/g) || []).length;
    const activeParameter = Math.min(commaCount, funcSig.parameters.length - 1);

    return {
        signatures: [
            {
                label: `${funcSig.name}(${funcSig.parameters.map((p: FunctionParameter) => `${p.name}: ${Array.isArray(p.type) ? p.type.join(' | ') : p.type}`).join(', ')})`,
                documentation: funcSig.description,
                parameters: funcSig.parameters.map((p: FunctionParameter) => ({
                    label: p.name,
                    documentation: p.description
                }))
            }
        ],
        activeSignature: 0,
        activeParameter
    };
});

// Definition provider - Go to Definition (Ctrl+Click)
connection.onDefinition((params: DefinitionParams): Definition | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        return null;
    }

    const text = document.getText();

    // Get the dotted path at cursor (e.g., Data.orders)
    const dottedPath = getDottedPathAtPosition(document, params.position);
    if (!dottedPath) {
        return null;
    }

    const analyzer = new DocumentAnalyzer(text, params.textDocument.uri);
    const symbols = analyzer.getSymbols();

    // Find the symbol definition (try full path first, then just the word)
    let symbol = symbols.find(s => s.name === dottedPath.fullPath);
    if (!symbol) {
        symbol = symbols.find(s => s.name === dottedPath.word);
    }

    if (symbol) {
        return {
            uri: params.textDocument.uri,
            range: {
                start: { line: symbol.line, character: symbol.character },
                end: { line: symbol.line, character: symbol.character + symbol.name.length }
            }
        };
    }

    return null;
});

// Helper function to get word range at position
function getWordRangeAtPosition(document: TextDocument, position: { line: number; character: number }) {
    const text = document.getText();
    const offset = document.offsetAt(position);

    let start = offset;
    let end = offset;

    // Find word boundaries
    while (start > 0 && /\w/.test(text[start - 1])) {
        start--;
    }
    while (end < text.length && /\w/.test(text[end])) {
        end++;
    }

    if (start === end) {
        return null;
    }

    return {
        start: document.positionAt(start),
        end: document.positionAt(end)
    };
}

// Helper function to get dotted path at position (e.g., Data.orders)
function getDottedPathAtPosition(document: TextDocument, position: { line: number; character: number }): { word: string; fullPath: string } | null {
    const text = document.getText();
    const lines = text.split('\n');
    if (position.line >= lines.length) {
        return null;
    }

    const line = lines[position.line];
    const char = position.character;

    // Find word boundaries (alphanumeric + underscore)
    let wordStart = char;
    let wordEnd = char;
    while (wordStart > 0 && /\w/.test(line[wordStart - 1])) {
        wordStart--;
    }
    while (wordEnd < line.length && /\w/.test(line[wordEnd])) {
        wordEnd++;
    }

    if (wordStart === wordEnd) {
        return null;
    }

    const word = line.substring(wordStart, wordEnd);

    // Extend to capture full dotted path (e.g., Data.orders.items)
    let pathStart = wordStart;
    let pathEnd = wordEnd;

    // Look backwards for dots and identifiers
    while (pathStart > 1 && line[pathStart - 1] === '.' && /\w/.test(line[pathStart - 2])) {
        pathStart -= 2;
        while (pathStart > 0 && /\w/.test(line[pathStart - 1])) {
            pathStart--;
        }
    }

    // Look forwards for dots and identifiers
    while (pathEnd < line.length - 1 && line[pathEnd] === '.' && /\w/.test(line[pathEnd + 1])) {
        pathEnd++;
        while (pathEnd < line.length && /\w/.test(line[pathEnd])) {
            pathEnd++;
        }
    }

    const fullPath = line.substring(pathStart, pathEnd);

    return { word, fullPath };
}

// Document formatting
function formatJyroDocument(text: string, options: { tabSize: number; insertSpaces: boolean }): string {
    const rawLines = text.split(/\r?\n/);
    const formattedLines: string[] = [];
    const indent = options.insertSpaces ? ' '.repeat(options.tabSize) : '\t';
    let currentIndent = 0;

    // Keywords that increase indent after the line
    const indentIncreaseAfter = /^(if|while|for|foreach|switch|case|default)\b/;
    const blockContinue = /^(else|elseif)\b/;
    const caseContinue = /^(case|default)\b/;
    const blockEnd = /^end\b/;
    const thenOrDo = /\b(then|do)\b/;
    const hasEndOnLine = /\bend\b/;

    // Track whether we're inside a case body (to know when to de-indent for next case)
    let inCaseBody = false;

    // Split lines on statement keywords that appear mid-line
    const lines: string[] = [];
    for (const rawLine of rawLines) {
        const splitLines = splitOnKeywords(rawLine);
        lines.push(...splitLines);
    }

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Preserve blank lines
        if (line.trim() === '') {
            formattedLines.push('');
            continue;
        }

        // Trim the line and process it
        let trimmed = line.trim();

        // Format operators with spaces (C# style)
        trimmed = formatOperators(trimmed);

        // Determine indent changes
        const trimmedLower = trimmed.toLowerCase();

        // Count braces and parens outside strings
        const openBraces = countBracesOutsideStrings(trimmed, '{');
        const closeBraces = countBracesOutsideStrings(trimmed, '}');
        const openParens = countBracesOutsideStrings(trimmed, '(');
        const closeParens = countBracesOutsideStrings(trimmed, ')');

        // Check if this line is self-contained (has 'end' on the same line)
        const isSelfContained = hasEndOnLine.test(trimmedLower) && !blockEnd.test(trimmedLower);

        // Decrease indent before 'end', 'else', 'elseif'
        if (blockEnd.test(trimmedLower) || blockContinue.test(trimmedLower)) {
            // 'end' after a case body needs to drop 2 levels (case body + switch body)
            if (blockEnd.test(trimmedLower) && inCaseBody) {
                currentIndent = Math.max(0, currentIndent - 2);
                inCaseBody = false;
            } else {
                currentIndent = Math.max(0, currentIndent - 1);
            }
        }

        // Decrease indent before 'case'/'default' only if inside a previous case body
        if (caseContinue.test(trimmedLower)) {
            if (inCaseBody) {
                currentIndent = Math.max(0, currentIndent - 1);
            }
        }

        // Decrease indent for closing braces at the start of a line
        if (trimmed.startsWith('}')) {
            currentIndent = Math.max(0, currentIndent - closeBraces);
        }

        // Decrease indent for closing parens at the start of a line
        if (trimmed.startsWith(')')) {
            currentIndent = Math.max(0, currentIndent - closeParens);
        }

        // Apply current indent
        const indentedLine = indent.repeat(currentIndent) + trimmed;
        formattedLines.push(indentedLine);

        // Increase indent after block-starting keywords with 'then' or 'do'
        // or after 'else', 'elseif'
        if (!isSelfContained) {
            if (indentIncreaseAfter.test(trimmedLower) && thenOrDo.test(trimmedLower)) {
                currentIndent++;
                // Track when we enter a case body
                if (caseContinue.test(trimmedLower)) {
                    inCaseBody = true;
                }
            } else if (blockContinue.test(trimmedLower)) {
                currentIndent++;
            }
        }

        // Handle brace-based indentation for object/array literals
        if (!trimmed.startsWith('}')) {
            currentIndent = Math.max(0, currentIndent + openBraces - closeBraces);
        } else {
            currentIndent = currentIndent + openBraces;
        }

        // Handle paren-based indentation for multi-line function calls
        if (!trimmed.startsWith(')')) {
            currentIndent = Math.max(0, currentIndent + openParens - closeParens);
        } else {
            currentIndent = currentIndent + openParens;
        }
    }

    return formattedLines.join('\n');
}

// Count occurrences of a brace character outside of strings
function countBracesOutsideStrings(line: string, brace: string): number {
    let count = 0;
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

        if (!inString && char === brace) {
            count++;
        }
    }

    return count;
}

// Split a line on statement keywords (var, if, while, etc.) that appear mid-line
function splitOnKeywords(line: string): string[] {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
        return [line];
    }

    const trimmedLower = trimmed.toLowerCase();

    // Check if this is a self-contained block (e.g., "if x then y end")
    // These should NOT be split - they're intentionally on one line
    const isSelfContainedBlock = /^(if|while|for|foreach|switch|else|elseif|case|default)\b/.test(trimmedLower) &&
        /\b(then|do)\b/.test(trimmedLower) &&
        /\bend\s*$/.test(trimmedLower);

    const result: string[] = [];
    let current = '';
    let inString: false | '"' | "'" = false;
    let i = 0;

    while (i < trimmed.length) {
        const char = trimmed[i];

        // Track string state
        if ((char === '"' || char === "'") && (i === 0 || trimmed[i - 1] !== '\\')) {
            if (!inString) {
                inString = char;
            } else if (inString === char) {
                inString = false;
            }
            current += char;
            i++;
            continue;
        }

        if (inString) {
            current += char;
            i++;
            continue;
        }

        // Check if we're at a word boundary where a keyword might start
        const isWordStart = i === 0 || /\s/.test(trimmed[i - 1]);
        if (isWordStart) {
            const remaining = trimmed.slice(i);

            // Split on statement-starting keywords
            const statementMatch = remaining.match(/^(var|if|elseif|while|for|foreach|switch|case|default|return|fail|break|continue)\b/i);
            if (statementMatch && current.trim() !== '') {
                result.push(current.trim());
                current = '';
            }

            // Also split on 'end' if this is NOT a self-contained block
            if (!isSelfContainedBlock) {
                const endMatch = remaining.match(/^end\b/i);
                if (endMatch && current.trim() !== '') {
                    result.push(current.trim());
                    current = '';
                }
            }
        }

        current += char;
        i++;
    }

    if (current.trim() !== '') {
        result.push(current.trim());
    }

    return result.length > 0 ? result : [line];
}

function formatOperators(line: string): string {
    // Skip if line is a comment
    if (line.trim().startsWith('#')) {
        return line;
    }

    let result = '';
    let inString: false | '"' | "'" = false;
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1] || '';
        const prevChar = result[result.length - 1] || '';

        // Track string state
        if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
            if (!inString) {
                inString = char;
            } else if (inString === char) {
                inString = false;
            }
            result += char;
            i++;
            continue;
        }

        // Don't format inside strings
        if (inString) {
            result += char;
            i++;
            continue;
        }

        // Handle comments - stop processing
        if (char === '#') {
            result += line.substring(i);
            break;
        }

        // Handle two-character operators
        const twoChar = char + nextChar;
        if (['==', '!=', '<=', '>=', '=>', '++', '--', '??', '+=', '-=', '*=', '/=', '%='].includes(twoChar)) {
            // Remove trailing space if present
            if (result.endsWith(' ')) {
                result = result.slice(0, -1);
            }
            // ++ and -- don't need spaces around them
            if (twoChar === '++' || twoChar === '--') {
                result += twoChar;
            } else {
                result += ' ' + twoChar + ' ';
            }
            i += 2;
            continue;
        }

        // Handle single-character operators (but not in special cases)
        if (['+', '-', '*', '/', '%', '<', '>', '='].includes(char)) {
            // Don't add spaces for negative numbers at start or after operators/open parens
            if ((char === '-' || char === '+') &&
                (prevChar === '' || prevChar === '(' || prevChar === ',' || prevChar === '=' || prevChar === ' ' && /[=<>!+\-*/%,(]/.test(result[result.length - 2] || ''))) {
                // Check if next char is a digit (negative/positive number)
                if (/\d/.test(nextChar)) {
                    result += char;
                    i++;
                    continue;
                }
            }

            // Remove trailing space if present
            if (result.endsWith(' ')) {
                result = result.slice(0, -1);
            }
            result += ' ' + char + ' ';
            i++;
            continue;
        }

        result += char;
        i++;
    }

    // Clean up multiple spaces (but preserve indentation)
    const leadingSpace = result.match(/^(\s*)/)?.[1] || '';
    let content = result.substring(leadingSpace.length);

    // Replace multiple spaces with single space
    content = content.replace(/  +/g, ' ');

    // Remove space between function name and opening paren: SomeFunction ( -> SomeFunction(
    // But preserve space after control keywords: if (, while (, foreach (, switch (
    content = content.replace(/\b(\w+)\s+\(/g, (match, word) => {
        const keywords = ['if', 'while', 'for', 'foreach', 'switch'];
        if (keywords.includes(word)) {
            return word + ' ('; // Keep single space for keywords
        }
        return word + '(';
    });

    return leadingSpace + content.trim();
}

// Document formatting handler
connection.onDocumentFormatting((params: DocumentFormattingParams): TextEdit[] => {
    connection.console.log('Document formatting requested');
    const document = documents.get(params.textDocument.uri);
    if (!document) {
        connection.console.log('Document not found');
        return [];
    }

    const text = document.getText();
    const formatted = formatJyroDocument(text, {
        tabSize: params.options.tabSize,
        insertSpaces: params.options.insertSpaces
    });

    // Return a single edit replacing the entire document
    const lastLine = document.lineCount - 1;
    const lastChar = document.getText({
        start: { line: lastLine, character: 0 },
        end: { line: lastLine, character: Number.MAX_SAFE_INTEGER }
    }).length;

    return [{
        range: {
            start: { line: 0, character: 0 },
            end: { line: lastLine, character: lastChar }
        },
        newText: formatted
    }];
});

// Make the text document manager listen on the connection
documents.listen(connection);

// Listen on the connection
connection.listen();
