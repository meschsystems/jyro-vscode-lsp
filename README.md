# Jyro Language Support for VS Code

Full-featured Language Server Protocol (LSP) implementation for the [Jyro](https://www.jyro.dev) scripting language.

## Features

### Syntax Highlighting
- Complete syntax highlighting for all Jyro keywords, operators, and constructs
- Specialized highlighting for the `Data` root object
- Support for all standard library functions
- String escape sequence highlighting
- Number literal highlighting

### IntelliSense & Auto-Completion
- **Keyword completion**: All Jyro keywords (var, if, while, foreach, etc.)
- **Type completion**: Type annotations (number, string, boolean, object, array)
- **Function completion**: All standard library functions with signatures
- **Variable completion**: Context-aware variable suggestions
- **Snippet completion**: Common patterns and control structures

### Hover Information
- Function signatures with parameter types
- Parameter descriptions and return types
- Usage examples for standard library functions
- Keyword explanations
- Category information (String, Array, Math, DateTime, Utility)

### Signature Help
- Real-time parameter hints while typing function calls
- Current parameter highlighting
- Parameter type information

### Diagnostics & Error Detection
- **Syntax errors**: Unclosed strings, brackets, blocks
- **Semantic errors**: Undefined variables and functions
- **Control flow errors**: break/continue outside loops, unreachable code after return/fail
- **Type errors**: Invalid type annotations
- **Loop validation**: Invalid for-loop step values (zero or negative)
- **Block structure**: Unclosed if/while/foreach/switch/case/default blocks

### Code Snippets
40+ pre-built snippets for:
- Variable declarations
- Control structures (if/while/foreach/switch)
- Function calls
- Data manipulation
- Common patterns

### Additional Features
- Document symbols and outline
- Smart indentation
- Auto-closing pairs for brackets, quotes
- Code folding for control structures
- Comment toggling

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the extension:
   ```bash
   npm run compile && npm run compile:esbuild
   ```
4. Press F5 to open a new VS Code window with the extension loaded

## Configuration

Configure the extension in VS Code settings:

```json
{
  "jyro.trace.server": "off",           // Server trace level
  "jyro.maxNumberOfProblems": 100,      // Max diagnostics
  "jyro.format.indentSize": 4,          // Indent size
  "jyro.format.useTabs": false          // Use tabs
}
```

## Requirements

- VS Code 1.85.0 or higher
- Node.js 20.x or higher

## Development

### Building from Source

```powershell
# Install dependencies
npm install

# Type-check and bundle
npm run compile && npm run compile:esbuild

# Watch for changes (auto-rebuilds dist/ on save)
npm run watch

# Run tests
npm test
```

### Project Structure

```
JyroVsCodeLanguageServer/
├── client/              # VS Code extension client
├── server/              # Language server implementation
├── shared/              # Shared types and utilities
├── syntaxes/            # TextMate grammar
├── snippets/            # Code snippets
└── package.json         # Extension manifest
```

## About Jyro

Jyro is a secure, sandboxed imperative scripting language designed for .NET 8+ that specializes in:
- Data transformation and ETL operations
- Business rule evaluation
- Safe execution of user-provided scripts
- Integration with .NET applications

Learn more at [jyro.dev](https://www.jyro.dev) or [docs.mesch.cloud/jyro](https://docs.mesch.cloud/jyro/)

## License

MIT License - Copyright (c) 2025-2026 Mesch Systems

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For information, issues and feature requests, please visit:
- [GitHub Issues](https://github.com/meschsystems/Mesch.Jyro.VSCode/issues)
- [Jyro Documentation](https://docs.mesch.cloud/jyro/)
- [Jyro Website](https://www.jyro.dev)