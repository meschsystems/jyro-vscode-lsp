/**
 * Jyro Standard Library Function Registry
 * Contains all built-in functions with their signatures and documentation
 */

import { JyroType } from './types';

export interface FunctionParameter {
    name: string;
    type: JyroType | JyroType[];
    optional?: boolean;
    description: string;
}

export interface FunctionSignature {
    name: string;
    category: string;
    parameters: FunctionParameter[];
    returnType: JyroType | JyroType[];
    description: string;
    examples?: string[];
}

const anyType: JyroType[] = [JyroType.Null, JyroType.Number, JyroType.String, JyroType.Boolean, JyroType.Object, JyroType.Array];

/**
 * Complete standard library function registry
 */
export const STDLIB_FUNCTIONS: FunctionSignature[] = [
    // ===== String Functions (18) =====
    {
        name: 'ToUpper',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to convert' }
        ],
        returnType: JyroType.String,
        description: 'Converts a string to uppercase (invariant culture)',
        examples: ['ToUpper("hello") # Returns "HELLO"']
    },
    {
        name: 'ToLower',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to convert' }
        ],
        returnType: JyroType.String,
        description: 'Converts a string to lowercase (invariant culture)',
        examples: ['ToLower("HELLO") # Returns "hello"']
    },
    {
        name: 'Trim',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to trim' }
        ],
        returnType: JyroType.String,
        description: 'Removes leading and trailing whitespace from a string',
        examples: ['Trim("  hello  ") # Returns "hello"']
    },
    {
        name: 'Replace',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The input string' },
            { name: 'old', type: JyroType.String, description: 'The substring to search for' },
            { name: 'new', type: JyroType.String, description: 'The replacement string' }
        ],
        returnType: JyroType.String,
        description: 'Replaces all occurrences of a substring with another string',
        examples: ['Replace("hello world", "world", "there") # Returns "hello there"']
    },
    {
        name: 'Contains',
        category: 'String',
        parameters: [
            { name: 'haystack', type: [JyroType.String, JyroType.Array], description: 'The string or array to search in' },
            { name: 'needle', type: anyType, description: 'The value to search for' }
        ],
        returnType: JyroType.Boolean,
        description: 'Checks if a string contains a substring, or if an array contains an element',
        examples: ['Contains("hello", "ell") # Returns true', 'Contains([1, 2, 3], 2) # Returns true']
    },
    {
        name: 'StartsWith',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to check' },
            { name: 'prefix', type: JyroType.String, description: 'The prefix to check for' }
        ],
        returnType: JyroType.Boolean,
        description: 'Checks if a string starts with a specific prefix',
        examples: ['StartsWith("hello", "hel") # Returns true']
    },
    {
        name: 'EndsWith',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to check' },
            { name: 'suffix', type: JyroType.String, description: 'The suffix to check for' }
        ],
        returnType: JyroType.Boolean,
        description: 'Checks if a string ends with a specific suffix',
        examples: ['EndsWith("hello", "lo") # Returns true']
    },
    {
        name: 'Split',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to split' },
            { name: 'delim', type: JyroType.String, description: 'The delimiter to split on' }
        ],
        returnType: JyroType.Array,
        description: 'Splits a string into an array using a delimiter',
        examples: ['Split("a,b,c", ",") # Returns ["a", "b", "c"]']
    },
    {
        name: 'Join',
        category: 'String',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to join' },
            { name: 'sep', type: JyroType.String, description: 'The separator between elements' }
        ],
        returnType: JyroType.String,
        description: 'Joins an array into a string with a separator',
        examples: ['Join(["a", "b", "c"], ",") # Returns "a,b,c"']
    },
    {
        name: 'Substring',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The source string' },
            { name: 'start', type: JyroType.Number, description: 'The start index (0-based)' },
            { name: 'len', type: JyroType.Number, description: 'Number of characters (optional, defaults to end of string)', optional: true }
        ],
        returnType: JyroType.String,
        description: 'Extracts a substring starting at the given index',
        examples: ['Substring("hello", 1, 3) # Returns "ell"', 'Substring("hello", 2) # Returns "llo"']
    },
    {
        name: 'ToNumber',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to convert' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Converts a string to a number. Returns null if the string is not a valid number.',
        examples: ['ToNumber("42") # Returns 42', 'ToNumber("abc") # Returns null']
    },
    {
        name: 'PadLeft',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to pad' },
            { name: 'width', type: JyroType.Number, description: 'The total desired width' },
            { name: 'char', type: JyroType.String, description: 'Padding character (defaults to space)', optional: true }
        ],
        returnType: JyroType.String,
        description: 'Pads a string on the left to the specified width',
        examples: ['PadLeft("42", 5, "0") # Returns "00042"']
    },
    {
        name: 'PadRight',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to pad' },
            { name: 'width', type: JyroType.Number, description: 'The total desired width' },
            { name: 'char', type: JyroType.String, description: 'Padding character (defaults to space)', optional: true }
        ],
        returnType: JyroType.String,
        description: 'Pads a string on the right to the specified width',
        examples: ['PadRight("hi", 5, ".") # Returns "hi..."']
    },
    {
        name: 'RegexTest',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The source text to search' },
            { name: 'pattern', type: JyroType.String, description: 'The regex pattern to match' }
        ],
        returnType: JyroType.Boolean,
        description: 'Tests if the pattern matches anywhere in the text',
        examples: ['RegexTest("hello@example.com", "[a-zA-Z]+@[a-zA-Z]+") # Returns true']
    },
    {
        name: 'RegexMatch',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The source text to search' },
            { name: 'pattern', type: JyroType.String, description: 'The regex pattern to match' }
        ],
        returnType: [JyroType.String, JyroType.Null],
        description: 'Extracts the first regex match as a string, or null if no match',
        examples: ['RegexMatch("Hello World", "[A-Z][a-z]+") # Returns "Hello"']
    },
    {
        name: 'RegexMatchAll',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The source text to search' },
            { name: 'pattern', type: JyroType.String, description: 'The regex pattern to match' }
        ],
        returnType: JyroType.Array,
        description: 'Extracts all regex matches as an array of strings. Returns empty array if no matches.',
        examples: ['RegexMatchAll("cat bat rat", "[a-z]+at") # Returns ["cat", "bat", "rat"]']
    },
    {
        name: 'RegexMatchDetail',
        category: 'String',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The source text to search' },
            { name: 'pattern', type: JyroType.String, description: 'The regex pattern to match' }
        ],
        returnType: [JyroType.Object, JyroType.Null],
        description: 'Extracts the first match with metadata {match, index, groups}, or null if no match',
        examples: ['RegexMatchDetail("john@example.com", "([a-z]+)@([a-z]+)[.]([a-z]+)")']
    },
    {
        name: 'RandomString',
        category: 'String',
        parameters: [
            { name: 'len', type: JyroType.Number, description: 'The length of the string to generate' },
            { name: 'charset', type: JyroType.String, description: 'The set of characters to select from (defaults to alphanumeric)', optional: true }
        ],
        returnType: JyroType.String,
        description: 'Generates a random string of specified length from a character set',
        examples: ['RandomString(8) # Returns "aB3xK9mP"', 'RandomString(6, "0123456789") # Returns "483921"']
    },

    // ===== Array Functions (23) =====
    {
        name: 'Length',
        category: 'Array',
        parameters: [
            { name: 'v', type: anyType, description: 'A string, array, or object to measure' }
        ],
        returnType: JyroType.Number,
        description: 'Returns string length, array length, or object key count. Returns 0 for null.',
        examples: ['Length([1, 2, 3]) # Returns 3', 'Length("hello") # Returns 5']
    },
    {
        name: 'Append',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to append to' },
            { name: 'val', type: anyType, description: 'The value to append' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array with value appended',
        examples: ['Append([1, 2], 3) # Returns [1, 2, 3]']
    },
    {
        name: 'Prepend',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to prepend to' },
            { name: 'val', type: anyType, description: 'The value to prepend' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array with value prepended',
        examples: ['Prepend([2, 3], 1) # Returns [1, 2, 3]']
    },
    {
        name: 'First',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to get first element from' }
        ],
        returnType: anyType,
        description: 'Returns the first element of an array, or null if empty',
        examples: ['First([1, 2, 3]) # Returns 1']
    },
    {
        name: 'Last',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to get last element from' }
        ],
        returnType: anyType,
        description: 'Returns the last element of an array, or null if empty',
        examples: ['Last([1, 2, 3]) # Returns 3']
    },
    {
        name: 'IndexOf',
        category: 'Array',
        parameters: [
            { name: 'source', type: [JyroType.String, JyroType.Array], description: 'The string or array to search' },
            { name: 'search', type: anyType, description: 'The value to find' }
        ],
        returnType: JyroType.Number,
        description: 'Returns the index of the first occurrence, or -1 if not found',
        examples: ['IndexOf([1, 2, 3], 2) # Returns 1', 'IndexOf("hello", "ell") # Returns 1']
    },
    {
        name: 'Reverse',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to reverse' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new reversed array',
        examples: ['Reverse([1, 2, 3]) # Returns [3, 2, 1]']
    },
    {
        name: 'Slice',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to slice' },
            { name: 'start', type: JyroType.Number, description: 'Start index (inclusive)' },
            { name: 'end', type: JyroType.Number, description: 'End index (exclusive, defaults to length)', optional: true }
        ],
        returnType: JyroType.Array,
        description: 'Extracts a section of an array',
        examples: ['Slice([1, 2, 3, 4, 5], 1, 3) # Returns [2, 3]']
    },
    {
        name: 'Concatenate',
        category: 'Array',
        parameters: [
            { name: 'a', type: JyroType.Array, description: 'First array' },
            { name: 'b', type: JyroType.Array, description: 'Second array' }
        ],
        returnType: JyroType.Array,
        description: 'Joins two arrays together',
        examples: ['Concatenate([1, 2], [3, 4]) # Returns [1, 2, 3, 4]']
    },
    {
        name: 'Distinct',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to deduplicate' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array with duplicate values removed (first occurrence kept)',
        examples: ['Distinct([1, 2, 2, 3, 3]) # Returns [1, 2, 3]']
    },
    {
        name: 'Sort',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to sort' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a sorted array. Order: nulls, numbers, strings, booleans.',
        examples: ['Sort([3, 1, 2]) # Returns [1, 2, 3]']
    },
    {
        name: 'Flatten',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The nested array to flatten' }
        ],
        returnType: JyroType.Array,
        description: 'Recursively flattens nested arrays',
        examples: ['Flatten([[1, 2], [3, [4, 5]]]) # Returns [1, 2, 3, 4, 5]']
    },
    {
        name: 'FlattenOnce',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The nested array to flatten one level' }
        ],
        returnType: JyroType.Array,
        description: 'Flattens one level of nesting',
        examples: ['FlattenOnce([[1, 2], [3, [4]]]) # Returns [1, 2, 3, [4]]']
    },
    {
        name: 'Range',
        category: 'Array',
        parameters: [
            { name: 'start', type: JyroType.Number, description: 'Start value (inclusive)' },
            { name: 'end', type: JyroType.Number, description: 'End value (inclusive)' },
            { name: 'step', type: JyroType.Number, description: 'Step size (defaults to 1)', optional: true }
        ],
        returnType: JyroType.Array,
        description: 'Generates an array of numbers in a range',
        examples: ['Range(1, 5) # Returns [1, 2, 3, 4, 5]', 'Range(0, 10, 2) # Returns [0, 2, 4, 6, 8, 10]']
    },
    {
        name: 'Skip',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The source array' },
            { name: 'n', type: JyroType.Number, description: 'Number of elements to skip' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array with the first n elements removed',
        examples: ['Skip([1, 2, 3, 4, 5], 2) # Returns [3, 4, 5]']
    },
    {
        name: 'Insert',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to insert into' },
            { name: 'idx', type: JyroType.Number, description: 'The index to insert at' },
            { name: 'val', type: anyType, description: 'The value to insert' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array with value inserted at the specified index',
        examples: ['Insert([1, 3], 1, 2) # Returns [1, 2, 3]']
    },
    {
        name: 'RemoveAt',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to remove from' },
            { name: 'idx', type: JyroType.Number, description: 'The index to remove' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array without the element at the specified index',
        examples: ['RemoveAt([1, 2, 3], 1) # Returns [1, 3]']
    },
    {
        name: 'RemoveFirst',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to remove from' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array without the first element',
        examples: ['RemoveFirst([1, 2, 3]) # Returns [2, 3]']
    },
    {
        name: 'RemoveLast',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to remove from' }
        ],
        returnType: JyroType.Array,
        description: 'Returns a new array without the last element',
        examples: ['RemoveLast([1, 2, 3]) # Returns [1, 2]']
    },
    {
        name: 'RandomChoice',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to select from' }
        ],
        returnType: anyType,
        description: 'Selects a random element from an array, or returns null if empty',
        examples: ['RandomChoice(["red", "blue", "green"]) # Returns a random color']
    },
    {
        name: 'SortByField',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects to sort' },
            { name: 'field', type: JyroType.String, description: 'The field name to sort by' },
            { name: 'dir', type: JyroType.String, description: 'Sort direction ("asc" or "desc")' }
        ],
        returnType: JyroType.Array,
        description: 'Sorts an array of objects by a specific field',
        examples: ['SortByField(Data.users, "age", "desc") # Sorts by age descending']
    },
    {
        name: 'GroupBy',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects to group' },
            { name: 'field', type: JyroType.String, description: 'The field name to group by' }
        ],
        returnType: JyroType.Object,
        description: 'Groups an array of objects by field value into {key: [items]}',
        examples: ['GroupBy(orders, "status") # Returns {"pending": [...], "completed": [...]}']
    },
    {
        name: 'SelectMany',
        category: 'Array',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects' },
            { name: 'field', type: JyroType.String, description: 'The array field to flatten' }
        ],
        returnType: JyroType.Array,
        description: 'Flattens array fields from objects into a single array',
        examples: ['SelectMany(Data.documents, "tags") # Collects all tags']
    },

    // ===== Math Functions (14) =====
    {
        name: 'Abs',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The number' }
        ],
        returnType: JyroType.Number,
        description: 'Returns the absolute value of a number',
        examples: ['Abs(-5) # Returns 5']
    },
    {
        name: 'Floor',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The number to round down' }
        ],
        returnType: JyroType.Number,
        description: 'Rounds a number down to the nearest integer',
        examples: ['Floor(3.7) # Returns 3']
    },
    {
        name: 'Ceiling',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The number to round up' }
        ],
        returnType: JyroType.Number,
        description: 'Rounds a number up to the nearest integer',
        examples: ['Ceiling(3.2) # Returns 4']
    },
    {
        name: 'Min',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Returns the minimum number in an array, or null if no numbers found',
        examples: ['Min([5, 10, 3]) # Returns 3']
    },
    {
        name: 'Max',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Returns the maximum number in an array, or null if no numbers found',
        examples: ['Max([5, 10, 3]) # Returns 10']
    },
    {
        name: 'Power',
        category: 'Math',
        parameters: [
            { name: 'base', type: JyroType.Number, description: 'The base number' },
            { name: 'exp', type: JyroType.Number, description: 'The exponent' }
        ],
        returnType: JyroType.Number,
        description: 'Returns base raised to the power of exponent',
        examples: ['Power(2, 10) # Returns 1024']
    },
    {
        name: 'SquareRoot',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The number' }
        ],
        returnType: JyroType.Number,
        description: 'Returns the square root of a number',
        examples: ['SquareRoot(16) # Returns 4']
    },
    {
        name: 'Log',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The number' },
            { name: 'base', type: JyroType.Number, description: 'Log base (defaults to natural log)', optional: true }
        ],
        returnType: JyroType.Number,
        description: 'Returns the logarithm of a number. Natural log if no base specified.',
        examples: ['Log(100, 10) # Returns 2']
    },
    {
        name: 'Sum',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: JyroType.Number,
        description: 'Returns the sum of all numbers in an array. Non-numbers ignored. Returns 0 if none.',
        examples: ['Sum([1, 2, 3, 4]) # Returns 10']
    },
    {
        name: 'Average',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Returns the arithmetic mean of numbers in an array, or null if empty',
        examples: ['Average([10, 20, 30]) # Returns 20']
    },
    {
        name: 'Clamp',
        category: 'Math',
        parameters: [
            { name: 'n', type: JyroType.Number, description: 'The value to clamp' },
            { name: 'min', type: JyroType.Number, description: 'Minimum bound' },
            { name: 'max', type: JyroType.Number, description: 'Maximum bound' }
        ],
        returnType: JyroType.Number,
        description: 'Constrains a number to a range',
        examples: ['Clamp(15, 0, 10) # Returns 10']
    },
    {
        name: 'Median',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Returns the median value, or null if no numbers found',
        examples: ['Median([1, 3, 5]) # Returns 3']
    },
    {
        name: 'Mode',
        category: 'Math',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of numbers' }
        ],
        returnType: [JyroType.Number, JyroType.Null],
        description: 'Returns the most frequently occurring number, or null if no numbers found',
        examples: ['Mode([1, 2, 2, 3, 3, 3]) # Returns 3']
    },
    {
        name: 'RandomInt',
        category: 'Math',
        parameters: [
            { name: 'min', type: JyroType.Number, description: 'Inclusive lower bound' },
            { name: 'max', type: JyroType.Number, description: 'Inclusive upper bound' }
        ],
        returnType: JyroType.Number,
        description: 'Generates a random integer in the inclusive range [min, max]',
        examples: ['RandomInt(1, 6) # Returns 1-6 (dice roll)']
    },

    // ===== Date/Time Functions (7) =====
    {
        name: 'Now',
        category: 'DateTime',
        parameters: [],
        returnType: JyroType.String,
        description: 'Returns the current UTC datetime in ISO 8601 format',
        examples: ['Now() # Returns "2025-11-17T12:00:00Z"']
    },
    {
        name: 'Today',
        category: 'DateTime',
        parameters: [],
        returnType: JyroType.String,
        description: 'Returns the current UTC date (yyyy-MM-dd)',
        examples: ['Today() # Returns "2025-11-17"']
    },
    {
        name: 'ParseDate',
        category: 'DateTime',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The date string to parse' }
        ],
        returnType: JyroType.String,
        description: 'Parses various date formats and returns ISO 8601',
        examples: ['ParseDate("2025-11-17") # Returns ISO 8601 date']
    },
    {
        name: 'FormatDate',
        category: 'DateTime',
        parameters: [
            { name: 'date', type: JyroType.String, description: 'The date in ISO format' },
            { name: 'fmt', type: JyroType.String, description: 'Format pattern (yyyy, MM, dd, HH, mm, ss)' }
        ],
        returnType: JyroType.String,
        description: 'Formats a date with a custom pattern',
        examples: ['FormatDate(Now(), "yyyy-MM-dd") # Returns "2025-11-17"']
    },
    {
        name: 'DateAdd',
        category: 'DateTime',
        parameters: [
            { name: 'date', type: JyroType.String, description: 'The date in ISO format' },
            { name: 'amount', type: JyroType.Number, description: 'Amount to add (can be negative)' },
            { name: 'unit', type: JyroType.String, description: 'Unit: days, weeks, months, years, hours, minutes, seconds' }
        ],
        returnType: JyroType.String,
        description: 'Adds a time interval to a date',
        examples: ['DateAdd(Today(), 7, "days") # Adds 7 days']
    },
    {
        name: 'DateDiff',
        category: 'DateTime',
        parameters: [
            { name: 'end', type: JyroType.String, description: 'The end date' },
            { name: 'start', type: JyroType.String, description: 'The start date' },
            { name: 'unit', type: JyroType.String, description: 'Unit to return difference in' }
        ],
        returnType: JyroType.Number,
        description: 'Calculates the difference between two dates',
        examples: ['DateDiff("2025-12-31", "2025-01-01", "days") # Returns 364']
    },
    {
        name: 'DatePart',
        category: 'DateTime',
        parameters: [
            { name: 'date', type: JyroType.String, description: 'The date in ISO format' },
            { name: 'part', type: JyroType.String, description: 'Part: year, month, day, hour, minute, second, dayofweek, dayofyear' }
        ],
        returnType: JyroType.Number,
        description: 'Extracts a specific part from a date',
        examples: ['DatePart(Now(), "year") # Returns 2025']
    },

    // ===== Query Functions (8) =====
    {
        name: 'WhereByField',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects to filter' },
            { name: 'field', type: JyroType.String, description: 'Field name or nested path (e.g., "address.city")' },
            { name: 'op', type: JyroType.String, description: 'Comparison operator (==, !=, <, <=, >, >=)' },
            { name: 'val', type: anyType, description: 'The value to compare against' }
        ],
        returnType: JyroType.Array,
        description: 'Filters an array of objects by a field condition',
        examples: ['WhereByField(Data.users, "age", ">=", 18) # Returns adult users']
    },
    {
        name: 'FindByField',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to search' },
            { name: 'field', type: JyroType.String, description: 'Field name or nested path' },
            { name: 'op', type: JyroType.String, description: 'Comparison operator' },
            { name: 'val', type: anyType, description: 'The value to compare against' }
        ],
        returnType: anyType,
        description: 'Returns the first object matching the condition, or null',
        examples: ['FindByField(Data.users, "id", "==", 123) # Returns the matching user']
    },
    {
        name: 'AnyByField',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to check' },
            { name: 'field', type: JyroType.String, description: 'Field name or nested path' },
            { name: 'op', type: JyroType.String, description: 'Comparison operator' },
            { name: 'val', type: anyType, description: 'The value to compare against' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if any element matches the condition. Short-circuits on first match.',
        examples: ['AnyByField(Data.users, "role", "==", "admin") # True if any admin exists']
    },
    {
        name: 'AllByField',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to check' },
            { name: 'field', type: JyroType.String, description: 'Field name or nested path' },
            { name: 'op', type: JyroType.String, description: 'Comparison operator' },
            { name: 'val', type: anyType, description: 'The value to compare against' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if all elements match the condition. True for empty arrays (vacuous truth).',
        examples: ['AllByField(Data.users, "verified", "==", true) # True if all verified']
    },
    {
        name: 'CountIf',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to count' },
            { name: 'field', type: JyroType.String, description: 'Field name to check' },
            { name: 'op', type: JyroType.String, description: 'Comparison operator' },
            { name: 'val', type: anyType, description: 'The value to compare against' }
        ],
        returnType: JyroType.Number,
        description: 'Counts elements matching a field condition',
        examples: ['CountIf(Data.users, "active", "==", true) # Returns count of active users']
    },
    {
        name: 'Select',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects' },
            { name: 'field', type: JyroType.String, description: 'The field name to extract' }
        ],
        returnType: JyroType.Array,
        description: 'Extracts a single field from each object in an array',
        examples: ['Select(Data.users, "name") # Returns array of names']
    },
    {
        name: 'Project',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects' },
            { name: 'fields', type: JyroType.Array, description: 'Array of field names to keep' }
        ],
        returnType: JyroType.Array,
        description: 'Returns objects with only the specified fields',
        examples: ['Project(Data.users, ["id", "name", "email"])']
    },
    {
        name: 'Omit',
        category: 'Query',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array of objects' },
            { name: 'fields', type: JyroType.Array, description: 'Array of field names to remove' }
        ],
        returnType: JyroType.Array,
        description: 'Returns objects with the specified fields removed',
        examples: ['Omit(Data.users, ["password", "token"])']
    },

    // ===== Lambda / Higher-Order Functions (8) =====
    {
        name: 'Map',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to transform' },
            { name: 'fn', type: anyType, description: 'Lambda: x => expression' }
        ],
        returnType: JyroType.Array,
        description: 'Transforms each element using a lambda expression',
        examples: ['Map(Data.numbers, x => x * 2) # Doubles each number']
    },
    {
        name: 'Where',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to filter' },
            { name: 'fn', type: anyType, description: 'Lambda: x => condition' }
        ],
        returnType: JyroType.Array,
        description: 'Filters elements using a lambda predicate',
        examples: ['Where(Data.numbers, x => x % 2 == 0) # Returns even numbers']
    },
    {
        name: 'Reduce',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to reduce' },
            { name: 'fn', type: anyType, description: 'Lambda: (acc, item) => result' },
            { name: 'init', type: anyType, description: 'Initial accumulator value' }
        ],
        returnType: anyType,
        description: 'Reduces an array to a single value using a lambda accumulator',
        examples: ['Reduce(Data.items, (sum, x) => sum + x.price, 0) # Total price']
    },
    {
        name: 'Each',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to iterate' },
            { name: 'fn', type: anyType, description: 'Lambda: x => expression (side effects)' }
        ],
        returnType: JyroType.Null,
        description: 'Executes a lambda for each element (for side effects). Returns null.',
        examples: ['Each(Data.items, x => x.processed = true)']
    },
    {
        name: 'Find',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to search' },
            { name: 'fn', type: anyType, description: 'Lambda: x => condition' }
        ],
        returnType: anyType,
        description: 'Returns the first element matching the lambda predicate, or null',
        examples: ['Find(Data.items, x => x.status == "pending") # First pending item']
    },
    {
        name: 'All',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to check' },
            { name: 'fn', type: anyType, description: 'Lambda: x => condition' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if all elements satisfy the lambda predicate. True for empty arrays.',
        examples: ['All(Data.items, x => x.price > 0) # True if all prices positive']
    },
    {
        name: 'Any',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to check' },
            { name: 'fn', type: anyType, description: 'Lambda: x => condition' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if any element satisfies the lambda predicate. False for empty arrays.',
        examples: ['Any(Data.items, x => x.expired) # True if any expired']
    },
    {
        name: 'SortBy',
        category: 'Lambda',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'The array to sort' },
            { name: 'fn', type: anyType, description: 'Lambda: x => sort key' }
        ],
        returnType: JyroType.Array,
        description: 'Sorts an array by a computed key from a lambda expression',
        examples: ['SortBy(Data.items, x => x.price) # Sort by price']
    },

    // ===== Utility Functions (16) =====
    {
        name: 'TypeOf',
        category: 'Utility',
        parameters: [
            { name: 'v', type: anyType, description: 'The value to check' }
        ],
        returnType: JyroType.String,
        description: 'Returns the type name: "null", "boolean", "number", "string", "array", or "object"',
        examples: ['TypeOf(42) # Returns "number"', 'TypeOf([1, 2]) # Returns "array"']
    },
    {
        name: 'Equal',
        category: 'Utility',
        parameters: [
            { name: 'a', type: anyType, description: 'First value' },
            { name: 'b', type: anyType, description: 'Second value' }
        ],
        returnType: JyroType.Boolean,
        description: 'Performs deep value equality comparison',
        examples: ['Equal([1, 2], [1, 2]) # Returns true']
    },
    {
        name: 'NotEqual',
        category: 'Utility',
        parameters: [
            { name: 'a', type: anyType, description: 'First value' },
            { name: 'b', type: anyType, description: 'Second value' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if values are not deeply equal',
        examples: ['NotEqual([1, 2], [1, 3]) # Returns true']
    },
    {
        name: 'Coalesce',
        category: 'Utility',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of values to check' }
        ],
        returnType: anyType,
        description: 'Returns the first non-null element in the array, or null if all are null',
        examples: ['Coalesce([null, null, "found"]) # Returns "found"']
    },
    {
        name: 'ToString',
        category: 'Utility',
        parameters: [
            { name: 'v', type: anyType, description: 'The value to convert' }
        ],
        returnType: JyroType.String,
        description: 'Converts any value to its string representation',
        examples: ['ToString(42) # Returns "42"']
    },
    {
        name: 'ToBoolean',
        category: 'Utility',
        parameters: [
            { name: 'v', type: anyType, description: 'The value to convert' }
        ],
        returnType: JyroType.Boolean,
        description: 'Converts a value to boolean using truthiness rules',
        examples: ['ToBoolean(1) # Returns true', 'ToBoolean(0) # Returns false']
    },
    {
        name: 'Keys',
        category: 'Utility',
        parameters: [
            { name: 'obj', type: JyroType.Object, description: 'The object to extract keys from' }
        ],
        returnType: JyroType.Array,
        description: 'Returns an array of the object\'s property names',
        examples: ['Keys({"name": "Alice", "age": 30}) # Returns ["name", "age"]']
    },
    {
        name: 'Values',
        category: 'Utility',
        parameters: [
            { name: 'obj', type: JyroType.Object, description: 'The object to extract values from' }
        ],
        returnType: JyroType.Array,
        description: 'Returns an array of the object\'s property values',
        examples: ['Values({"name": "Alice", "age": 30}) # Returns ["Alice", 30]']
    },
    {
        name: 'HasProperty',
        category: 'Utility',
        parameters: [
            { name: 'obj', type: JyroType.Object, description: 'The object to check' },
            { name: 'key', type: JyroType.String, description: 'The property name' }
        ],
        returnType: JyroType.Boolean,
        description: 'Returns true if the object has the specified property',
        examples: ['HasProperty(Data.user, "email") # True if user has email']
    },
    {
        name: 'Merge',
        category: 'Utility',
        parameters: [
            { name: 'arr', type: JyroType.Array, description: 'Array of objects to merge' }
        ],
        returnType: JyroType.Object,
        description: 'Merges an array of objects into one. Later objects override earlier ones (shallow merge).',
        examples: ['Merge([{"a": 1}, {"b": 2}]) # Returns {"a": 1, "b": 2}']
    },
    {
        name: 'Clone',
        category: 'Utility',
        parameters: [
            { name: 'v', type: anyType, description: 'The value to clone' }
        ],
        returnType: anyType,
        description: 'Creates a deep clone of a value',
        examples: ['Clone(Data.user) # Returns independent copy']
    },
    {
        name: 'NewGuid',
        category: 'Utility',
        parameters: [],
        returnType: JyroType.String,
        description: 'Generates a new lowercase hyphenated GUID string',
        examples: ['NewGuid() # Returns "a1b2c3d4-e5f6-7890-abcd-ef1234567890"']
    },
    {
        name: 'Base64Encode',
        category: 'Utility',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The string to encode' }
        ],
        returnType: JyroType.String,
        description: 'Encodes a string to Base64',
        examples: ['Base64Encode("hello") # Returns "aGVsbG8="']
    },
    {
        name: 'Base64Decode',
        category: 'Utility',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The Base64 string to decode' }
        ],
        returnType: JyroType.String,
        description: 'Decodes a Base64 string',
        examples: ['Base64Decode("aGVsbG8=") # Returns "hello"']
    },
    {
        name: 'FromJson',
        category: 'Utility',
        parameters: [
            { name: 's', type: JyroType.String, description: 'The JSON string to parse' }
        ],
        returnType: anyType,
        description: 'Parses a JSON string into a value. Returns null on error.',
        examples: ['FromJson(\'{"name": "Alice"}\') # Returns the parsed object']
    },
    {
        name: 'ToJson',
        category: 'Utility',
        parameters: [
            { name: 'v', type: anyType, description: 'The value to serialize' }
        ],
        returnType: JyroType.String,
        description: 'Serializes a value to a JSON string',
        examples: ['ToJson(Data.user) # Returns JSON representation']
    },
    {
        name: 'Sleep',
        category: 'Utility',
        parameters: [
            { name: 'ms', type: JyroType.Number, description: 'Non-negative integer milliseconds to pause' }
        ],
        returnType: JyroType.Null,
        description: 'Pauses script execution for the specified number of milliseconds. Negative or non-integer values raise a runtime error.',
        examples: ['Sleep(100) # Pauses for 100 milliseconds', 'Sleep(0) # No-op, returns immediately']
    },

    // ===== Schema Validation Functions (2) =====
    {
        name: 'ValidateRequired',
        category: 'Schema',
        parameters: [
            { name: 'obj', type: JyroType.Object, description: 'The object to validate' },
            { name: 'fields', type: JyroType.Array, description: 'Array of required field names' }
        ],
        returnType: JyroType.Object,
        description: 'Validates that required fields exist. Returns {valid: boolean, errors: array}.',
        examples: ['ValidateRequired(Data, ["name", "email"])']
    },
    {
        name: 'ValidateSchema',
        category: 'Schema',
        parameters: [
            { name: 'data', type: anyType, description: 'The data to validate' },
            { name: 'schema', type: JyroType.Object, description: 'JSON Schema object' }
        ],
        returnType: JyroType.Array,
        description: 'Validates data against a JSON Schema. Returns array of error strings (empty if valid).',
        examples: ['ValidateSchema(Data.payload, {"type": "object", "required": ["id"]})']
    }
];

/**
 * Get function signature by name
 */
export function getFunctionSignature(name: string): FunctionSignature | undefined {
    return STDLIB_FUNCTIONS.find(f => f.name.toLowerCase() === name.toLowerCase());
}

/**
 * Get all function names
 */
export function getAllFunctionNames(): string[] {
    return STDLIB_FUNCTIONS.map(f => f.name);
}

/**
 * Get functions by category
 */
export function getFunctionsByCategory(category: string): FunctionSignature[] {
    return STDLIB_FUNCTIONS.filter(f => f.category === category);
}

/**
 * All function categories
 */
export const FUNCTION_CATEGORIES = ['String', 'Array', 'Math', 'DateTime', 'Query', 'Lambda', 'Utility', 'Schema'];
