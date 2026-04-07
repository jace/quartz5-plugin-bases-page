import { createRequire } from 'module';

createRequire(import.meta.url);

// src/compiler/errors.ts
var CompilerError = class extends Error {
  span;
  severity;
  constructor(message, span, severity = "error" /* Error */) {
    super(message);
    this.name = "CompilerError";
    this.span = span;
    this.severity = severity;
  }
};

// src/compiler/compiler.ts
var LAZY_METHODS = /* @__PURE__ */ new Set(["filter", "map", "find", "some", "every", "flatMap"]);
var Compiler = class _Compiler {
  instructions = [];
  compile(expression) {
    this.compileExpression(expression);
    return this.instructions;
  }
  compileExpression(expression) {
    switch (expression.type) {
      case "Literal":
        this.compileLiteral(expression);
        return;
      case "Identifier":
        this.compileIdentifier(expression);
        return;
      case "List":
        this.compileList(expression);
        return;
      case "Unary":
        this.compileUnary(expression);
        return;
      case "Binary":
        this.compileBinary(expression);
        return;
      case "Member":
        this.compileMember(expression);
        return;
      case "Index":
        this.compileIndex(expression);
        return;
      case "Call":
        this.compileCall(expression);
        return;
    }
  }
  compileLiteral(expression) {
    this.emit({ type: "Const", value: expression.value });
  }
  compileIdentifier(expression) {
    this.emit({ type: "Ident", name: expression.name });
  }
  compileList(expression) {
    for (const element of expression.elements) {
      this.compileExpression(element);
    }
    this.emit({ type: "List", count: expression.elements.length });
  }
  compileUnary(expression) {
    this.compileExpression(expression.argument);
    this.emit({ type: "Unary", operator: expression.operator });
  }
  compileBinary(expression) {
    if (expression.operator === "&&" || expression.operator === "||") {
      this.compileLogical(expression);
      return;
    }
    this.compileExpression(expression.left);
    this.compileExpression(expression.right);
    this.emit({ type: "Binary", operator: expression.operator });
  }
  compileLogical(expression) {
    const operator = expression.operator;
    this.compileExpression(expression.left);
    this.emit({ type: "ToBool" });
    if (operator === "&&") {
      const jumpFalse = this.emit({ type: "JumpIfFalse", offset: 0 });
      this.compileExpression(expression.right);
      this.emit({ type: "ToBool" });
      const jumpEnd2 = this.emit({ type: "Jump", offset: 0 });
      const falseIndex = this.instructions.length;
      this.emit({ type: "Const", value: false });
      const endIndex2 = this.instructions.length;
      this.patchJump(jumpFalse, falseIndex);
      this.patchJump(jumpEnd2, endIndex2);
      return;
    }
    const jumpTrue = this.emit({ type: "JumpIfTrue", offset: 0 });
    this.compileExpression(expression.right);
    this.emit({ type: "ToBool" });
    const jumpEnd = this.emit({ type: "Jump", offset: 0 });
    const trueIndex = this.instructions.length;
    this.emit({ type: "Const", value: true });
    const endIndex = this.instructions.length;
    this.patchJump(jumpTrue, trueIndex);
    this.patchJump(jumpEnd, endIndex);
  }
  compileMember(expression) {
    if (expression.object.type === "Identifier" && expression.object.name === "formula" && expression.property) {
      this.emit({ type: "LoadFormula", name: expression.property });
      return;
    }
    this.compileExpression(expression.object);
    this.emit({ type: "Member", name: expression.property });
  }
  compileIndex(expression) {
    this.compileExpression(expression.object);
    this.compileExpression(expression.index);
    this.emit({ type: "Index" });
  }
  compileCall(expression) {
    if (expression.callee.type === "Identifier" && expression.callee.name === "if") {
      this.compileIfExpression(expression.args);
      return;
    }
    if (expression.callee.type === "Identifier") {
      for (const arg of expression.args) {
        this.compileExpression(arg);
      }
      this.emit({
        type: "CallGlobal",
        name: expression.callee.name,
        argc: expression.args.length
      });
      return;
    }
    if (expression.callee.type === "Member") {
      if (LAZY_METHODS.has(expression.callee.property)) {
        this.compileExpression(expression.callee.object);
        const argPrograms = [];
        for (const arg of expression.args) {
          const subCompiler = new _Compiler();
          argPrograms.push(subCompiler.compile(arg));
        }
        this.emit({
          type: "CallMethodLazy",
          name: expression.callee.property,
          argPrograms
        });
        return;
      }
      this.compileExpression(expression.callee.object);
      for (const arg of expression.args) {
        this.compileExpression(arg);
      }
      this.emit({
        type: "CallMethod",
        name: expression.callee.property,
        argc: expression.args.length
      });
      return;
    }
    throw new CompilerError("Unsupported call target", expression.span);
  }
  compileIfExpression(args) {
    const condition = args[0];
    const whenTrue = args[1];
    const whenFalse = args[2];
    if (!condition) {
      this.emit({ type: "Const", value: void 0 });
      return;
    }
    this.compileExpression(condition);
    this.emit({ type: "ToBool" });
    const jumpFalse = this.emit({ type: "JumpIfFalse", offset: 0 });
    if (whenTrue) {
      this.compileExpression(whenTrue);
    } else {
      this.emit({ type: "Const", value: void 0 });
    }
    const jumpEnd = this.emit({ type: "Jump", offset: 0 });
    const falseIndex = this.instructions.length;
    if (whenFalse) {
      this.compileExpression(whenFalse);
    } else {
      this.emit({ type: "Const", value: void 0 });
    }
    const endIndex = this.instructions.length;
    this.patchJump(jumpFalse, falseIndex);
    this.patchJump(jumpEnd, endIndex);
  }
  emit(instruction) {
    this.instructions.push(instruction);
    return this.instructions.length - 1;
  }
  patchJump(index, target) {
    const instruction = this.instructions[index];
    if (!instruction) {
      throw new CompilerError("Invalid jump patch", { start: 0, end: 0 });
    }
    if (instruction.type === "Jump") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }
    if (instruction.type === "JumpIfFalse") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }
    if (instruction.type === "JumpIfTrue") {
      this.instructions[index] = { ...instruction, offset: target - index };
      return;
    }
    throw new CompilerError("Cannot patch non-jump instruction", { start: 0, end: 0 });
  }
};
function compileAst(expression) {
  const compiler = new Compiler();
  const instructions = compiler.compile(expression);
  return { ast: expression, instructions };
}

// src/compiler/lexer.ts
var KEYWORDS = /* @__PURE__ */ new Map([
  ["true", "True" /* True */],
  ["false", "False" /* False */],
  ["null", "Null" /* Null */],
  ["and", "And" /* And */],
  ["or", "Or" /* Or */],
  ["not", "Not" /* Not */]
]);
function isWhitespace(ch) {
  return ch === " " || ch === "	" || ch === "\n" || ch === "\r";
}
function isDigit(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 48 && code <= 57;
}
function isAlpha(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function isIdentifierStart(ch) {
  return isAlpha(ch) || ch === "_" || ch === "$";
}
function isIdentifierPart(ch) {
  return isIdentifierStart(ch) || isDigit(ch);
}
var Lexer = class {
  input;
  index = 0;
  constructor(input) {
    this.input = input;
  }
  tokenize() {
    const tokens = [];
    while (!this.isAtEnd()) {
      const ch = this.peek();
      if (isWhitespace(ch)) {
        this.advance();
        continue;
      }
      if (isDigit(ch)) {
        tokens.push(this.readNumber());
        continue;
      }
      if (isIdentifierStart(ch)) {
        tokens.push(this.readIdentifier());
        continue;
      }
      if (ch === '"' || ch === "'") {
        tokens.push(this.readString());
        continue;
      }
      tokens.push(this.readSymbol());
    }
    tokens.push({
      type: "EOF" /* EOF */,
      value: "",
      span: { start: this.index, end: this.index }
    });
    return tokens;
  }
  readNumber() {
    const start = this.index;
    while (isDigit(this.peek())) {
      this.advance();
    }
    if (this.peek() === "." && isDigit(this.peekNext())) {
      this.advance();
      while (isDigit(this.peek())) {
        this.advance();
      }
    }
    const value = this.input.slice(start, this.index);
    return this.makeToken("Number" /* Number */, value, start, this.index);
  }
  readIdentifier() {
    const start = this.index;
    while (isIdentifierPart(this.peek())) {
      this.advance();
    }
    const value = this.input.slice(start, this.index);
    const keyword = KEYWORDS.get(value);
    if (keyword) {
      return this.makeToken(keyword, value, start, this.index);
    }
    return this.makeToken("Identifier" /* Identifier */, value, start, this.index);
  }
  readString() {
    const start = this.index;
    const quote = this.advance();
    let value = "";
    while (!this.isAtEnd()) {
      const ch = this.advance();
      if (ch === quote) {
        return this.makeToken("String" /* String */, value, start, this.index);
      }
      if (ch === "\\") {
        if (this.isAtEnd()) break;
        const escaped = this.advance();
        value += this.decodeEscape(escaped);
        continue;
      }
      value += ch;
    }
    throw new CompilerError("Unterminated string literal", { start, end: this.index });
  }
  readSymbol() {
    const start = this.index;
    const ch = this.advance();
    if (ch === "+") return this.makeToken("Plus" /* Plus */, ch, start, this.index);
    if (ch === "-") return this.makeToken("Minus" /* Minus */, ch, start, this.index);
    if (ch === "*") return this.makeToken("Star" /* Star */, ch, start, this.index);
    if (ch === "/") return this.makeToken("Slash" /* Slash */, ch, start, this.index);
    if (ch === "%") return this.makeToken("Percent" /* Percent */, ch, start, this.index);
    if (ch === "(") return this.makeToken("LeftParen" /* LeftParen */, ch, start, this.index);
    if (ch === ")") return this.makeToken("RightParen" /* RightParen */, ch, start, this.index);
    if (ch === "[") return this.makeToken("LeftBracket" /* LeftBracket */, ch, start, this.index);
    if (ch === "]") return this.makeToken("RightBracket" /* RightBracket */, ch, start, this.index);
    if (ch === ",") return this.makeToken("Comma" /* Comma */, ch, start, this.index);
    if (ch === ".") return this.makeToken("Dot" /* Dot */, ch, start, this.index);
    if (ch === "!") {
      if (this.match("=")) {
        return this.makeToken("BangEquals" /* BangEquals */, "!=", start, this.index);
      }
      return this.makeToken("Bang" /* Bang */, ch, start, this.index);
    }
    if (ch === "=") {
      if (this.match("=")) {
        return this.makeToken("EqualsEquals" /* EqualsEquals */, "==", start, this.index);
      }
      throw new CompilerError("Unexpected '='", { start, end: this.index });
    }
    if (ch === ">") {
      if (this.match("=")) {
        return this.makeToken("GreaterEqual" /* GreaterEqual */, ">=", start, this.index);
      }
      return this.makeToken("Greater" /* Greater */, ch, start, this.index);
    }
    if (ch === "<") {
      if (this.match("=")) {
        return this.makeToken("LessEqual" /* LessEqual */, "<=", start, this.index);
      }
      return this.makeToken("Less" /* Less */, ch, start, this.index);
    }
    if (ch === "&") {
      if (this.match("&")) {
        return this.makeToken("AndAnd" /* AndAnd */, "&&", start, this.index);
      }
      throw new CompilerError("Unexpected '&'", { start, end: this.index });
    }
    if (ch === "|") {
      if (this.match("|")) {
        return this.makeToken("OrOr" /* OrOr */, "||", start, this.index);
      }
      throw new CompilerError("Unexpected '|'", { start, end: this.index });
    }
    throw new CompilerError(`Unexpected character '${ch}'`, { start, end: this.index });
  }
  decodeEscape(ch) {
    if (ch === "n") return "\n";
    if (ch === "r") return "\r";
    if (ch === "t") return "	";
    if (ch === "\\") return "\\";
    if (ch === '"') return '"';
    if (ch === "'") return "'";
    return ch;
  }
  makeToken(type, value, start, end) {
    const span = { start, end };
    return { type, value, span };
  }
  match(expected) {
    if (this.peek() !== expected) return false;
    this.advance();
    return true;
  }
  peek() {
    return this.input[this.index] ?? "";
  }
  peekNext() {
    return this.input[this.index + 1] ?? "";
  }
  advance() {
    const ch = this.input[this.index] ?? "";
    this.index += 1;
    return ch;
  }
  isAtEnd() {
    return this.index >= this.input.length;
  }
};
function lex(input) {
  const lexer = new Lexer(input);
  return lexer.tokenize();
}

// src/compiler/parser.ts
var Parser = class {
  tokens;
  index = 0;
  constructor(tokens) {
    this.tokens = tokens;
  }
  parseExpression(precedence = 0 /* Lowest */) {
    let left = this.parsePrefix();
    while (!this.isAtEnd() && precedence < this.getPrecedence(this.peek())) {
      left = this.parseInfix(left);
    }
    return left;
  }
  parsePrefix() {
    const token = this.advance();
    switch (token.type) {
      case "Number" /* Number */: {
        const value = Number(token.value);
        if (Number.isNaN(value)) {
          throw new CompilerError("Invalid number literal", token.span);
        }
        return { type: "Literal", value, span: token.span };
      }
      case "String" /* String */:
        return { type: "Literal", value: token.value, span: token.span };
      case "True" /* True */:
        return { type: "Literal", value: true, span: token.span };
      case "False" /* False */:
        return { type: "Literal", value: false, span: token.span };
      case "Null" /* Null */:
        return { type: "Literal", value: null, span: token.span };
      case "Identifier" /* Identifier */:
        return { type: "Identifier", name: token.value, span: token.span };
      case "Bang" /* Bang */:
      case "Not" /* Not */:
      case "Minus" /* Minus */: {
        const operator = this.toUnaryOperator(token);
        const argument = this.parseExpression(7 /* Unary */);
        const span = this.mergeSpan(token.span, argument.span);
        return { type: "Unary", operator, argument, span };
      }
      case "LeftParen" /* LeftParen */: {
        const expression = this.parseExpression();
        this.expect("RightParen" /* RightParen */, "Expected ')' after expression");
        return expression;
      }
      case "LeftBracket" /* LeftBracket */:
        return this.parseList(token.span);
      default:
        throw new CompilerError("Unexpected token", token.span);
    }
  }
  parseInfix(left) {
    const token = this.peek();
    if (token.type === "LeftParen" /* LeftParen */) {
      this.advance();
      return this.parseCall(left);
    }
    if (token.type === "Dot" /* Dot */) {
      this.advance();
      return this.parseMember(left);
    }
    if (token.type === "LeftBracket" /* LeftBracket */) {
      this.advance();
      return this.parseIndex(left);
    }
    const operator = this.toBinaryOperator(token);
    const precedence = this.getPrecedence(token);
    this.advance();
    const right = this.parseExpression(precedence);
    const span = this.mergeSpan(left.span, right.span);
    return { type: "Binary", operator, left, right, span };
  }
  parseCall(callee) {
    const args = [];
    if (!this.check("RightParen" /* RightParen */)) {
      do {
        args.push(this.parseExpression());
      } while (this.match("Comma" /* Comma */));
    }
    const endToken = this.expect("RightParen" /* RightParen */, "Expected ')' after arguments");
    const span = this.mergeSpan(callee.span, endToken.span);
    return { type: "Call", callee, args, span };
  }
  parseMember(object) {
    const propertyToken = this.expect("Identifier" /* Identifier */, "Expected property name after '.'");
    const span = this.mergeSpan(object.span, propertyToken.span);
    return { type: "Member", object, property: propertyToken.value, span };
  }
  parseIndex(object) {
    const index = this.parseExpression();
    const endToken = this.expect("RightBracket" /* RightBracket */, "Expected ']' after index");
    const span = this.mergeSpan(object.span, endToken.span);
    return { type: "Index", object, index, span };
  }
  parseList(startSpan) {
    const elements = [];
    if (!this.check("RightBracket" /* RightBracket */)) {
      do {
        elements.push(this.parseExpression());
      } while (this.match("Comma" /* Comma */));
    }
    const endToken = this.expect("RightBracket" /* RightBracket */, "Expected ']' after list");
    const span = this.mergeSpan(startSpan, endToken.span);
    return { type: "List", elements, span };
  }
  toUnaryOperator(token) {
    if (token.type === "Bang" /* Bang */ || token.type === "Not" /* Not */) return "!";
    if (token.type === "Minus" /* Minus */) return "-";
    throw new CompilerError("Unsupported unary operator", token.span);
  }
  toBinaryOperator(token) {
    switch (token.type) {
      case "Plus" /* Plus */:
        return "+";
      case "Minus" /* Minus */:
        return "-";
      case "Star" /* Star */:
        return "*";
      case "Slash" /* Slash */:
        return "/";
      case "Percent" /* Percent */:
        return "%";
      case "EqualsEquals" /* EqualsEquals */:
        return "==";
      case "BangEquals" /* BangEquals */:
        return "!=";
      case "Greater" /* Greater */:
        return ">";
      case "GreaterEqual" /* GreaterEqual */:
        return ">=";
      case "Less" /* Less */:
        return "<";
      case "LessEqual" /* LessEqual */:
        return "<=";
      case "AndAnd" /* AndAnd */:
      case "And" /* And */:
        return "&&";
      case "OrOr" /* OrOr */:
      case "Or" /* Or */:
        return "||";
      default:
        throw new CompilerError("Unsupported binary operator", token.span);
    }
  }
  getPrecedence(token) {
    switch (token.type) {
      case "OrOr" /* OrOr */:
      case "Or" /* Or */:
        return 1 /* Or */;
      case "AndAnd" /* AndAnd */:
      case "And" /* And */:
        return 2 /* And */;
      case "EqualsEquals" /* EqualsEquals */:
      case "BangEquals" /* BangEquals */:
        return 3 /* Equality */;
      case "Greater" /* Greater */:
      case "GreaterEqual" /* GreaterEqual */:
      case "Less" /* Less */:
      case "LessEqual" /* LessEqual */:
        return 4 /* Comparison */;
      case "Plus" /* Plus */:
      case "Minus" /* Minus */:
        return 5 /* Term */;
      case "Star" /* Star */:
      case "Slash" /* Slash */:
      case "Percent" /* Percent */:
        return 6 /* Factor */;
      case "LeftParen" /* LeftParen */:
      case "LeftBracket" /* LeftBracket */:
      case "Dot" /* Dot */:
        return 8 /* Call */;
      default:
        return 0 /* Lowest */;
    }
  }
  mergeSpan(start, end) {
    return { start: start.start, end: end.end };
  }
  check(type) {
    return this.peek().type === type;
  }
  match(type) {
    if (!this.check(type)) return false;
    this.advance();
    return true;
  }
  expect(type, message) {
    const token = this.peek();
    if (token.type === type) {
      return this.advance();
    }
    throw new CompilerError(message, token.span);
  }
  advance() {
    const token = this.peek();
    this.index += 1;
    return token;
  }
  peek() {
    return this.tokens[this.index] ?? this.tokens[this.tokens.length - 1] ?? {
      type: "EOF" /* EOF */,
      value: "",
      span: { start: 0, end: 0 }
    };
  }
  isAtEnd() {
    return this.peek().type === "EOF" /* EOF */;
  }
  finish() {
    this.expect("EOF" /* EOF */, "Unexpected token after expression");
  }
};
function parse(tokens) {
  const parser = new Parser(tokens);
  const expression = parser.parseExpression();
  parser.finish();
  return expression;
}

// src/compiler/functions.ts
var globalFunctions = /* @__PURE__ */ new Map();
var methodFunctions = /* @__PURE__ */ new Map();
function getGlobalFunction(name) {
  return globalFunctions.get(name);
}
function getMethodFunction(name, target) {
  const category = getMethodTarget(target);
  if (!category) return void 0;
  return methodFunctions.get(category)?.get(name);
}
function registerGlobalFunction(name, fn) {
  globalFunctions.set(name, fn);
}
function registerMethodFunction(target, name, fn) {
  const group = methodFunctions.get(target) ?? /* @__PURE__ */ new Map();
  group.set(name, fn);
  methodFunctions.set(target, group);
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function toStringValue(value) {
  if (value === void 0 || value === null) return "";
  return String(value);
}
function toNumber(value) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}
function toInteger(value, fallback) {
  const numberValue = toNumber(value);
  if (numberValue === null) return fallback;
  return Math.trunc(numberValue);
}
function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
function flattenArgs(args) {
  if (args.length === 1 && Array.isArray(args[0])) return args[0];
  return args;
}
function collectNumericArgs(args) {
  const values = flattenArgs(args);
  const numbers = [];
  for (const value of values) {
    const numberValue = toNumber(value);
    if (numberValue !== null) numbers.push(numberValue);
  }
  return numbers;
}
function isFileValue(value) {
  if (!isRecord(value)) return false;
  return typeof value.name === "string" && typeof value.path === "string" && typeof value.folder === "string" && typeof value.ext === "string" && Array.isArray(value.tags) && Array.isArray(value.links) && typeof value.basename === "string";
}
function resolveSelfName(value) {
  if (!isRecord(value)) return null;
  if (isRecord(value.file) && typeof value.file.name === "string") {
    return value.file.name;
  }
  if (typeof value.name === "string" && typeof value.path === "string") {
    return value.basename || value.name;
  }
  return null;
}
function listContainsName(list, name) {
  return list.some((item) => {
    if (typeof item !== "string") return false;
    const match = item.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    if (match?.[1]) {
      return match[1] === name || match[1].endsWith(`/${name}`);
    }
    return item === name;
  });
}
function isDateValue(value) {
  return value instanceof Date;
}
function isAlpha2(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 65 && code <= 90 || code >= 97 && code <= 122;
}
function isDigit2(ch) {
  if (!ch) return false;
  const code = ch.charCodeAt(0);
  return code >= 48 && code <= 57;
}
function parseDuration(value) {
  const trimmed = value.trim();
  if (!trimmed) return void 0;
  const multipliers = {
    ms: 1,
    millisecond: 1,
    milliseconds: 1,
    s: 1e3,
    sec: 1e3,
    second: 1e3,
    seconds: 1e3,
    m: 6e4,
    min: 6e4,
    minute: 6e4,
    minutes: 6e4,
    h: 36e5,
    hr: 36e5,
    hour: 36e5,
    hours: 36e5,
    d: 864e5,
    day: 864e5,
    days: 864e5,
    w: 6048e5,
    week: 6048e5,
    weeks: 6048e5,
    mo: 2592e6,
    month: 2592e6,
    months: 2592e6,
    y: 31536e6,
    year: 31536e6,
    years: 31536e6
  };
  let index = 0;
  let total = 0;
  while (index < trimmed.length) {
    while (trimmed[index] === " " || trimmed[index] === "	") {
      index += 1;
    }
    if (index >= trimmed.length) break;
    const start = index;
    let hasDot = false;
    while (index < trimmed.length) {
      const ch = trimmed[index] ?? "";
      if (isDigit2(ch)) {
        index += 1;
        continue;
      }
      if (ch === "." && !hasDot) {
        hasDot = true;
        index += 1;
        continue;
      }
      break;
    }
    if (start === index) return void 0;
    const amount = Number(trimmed.slice(start, index));
    if (Number.isNaN(amount)) return void 0;
    while (index < trimmed.length && (trimmed[index] === " " || trimmed[index] === "	")) {
      index += 1;
    }
    const unitStart = index;
    while (index < trimmed.length && isAlpha2(trimmed[index] ?? "")) {
      index += 1;
    }
    const unit = trimmed.slice(unitStart, index).toLowerCase();
    const multiplier = unit ? multipliers[unit] : 1;
    if (unit && multiplier === void 0) return void 0;
    total += amount * (multiplier ?? 1);
  }
  return total;
}
function parseDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? void 0 : date;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return void 0;
    return new Date(parsed);
  }
  return void 0;
}
function resolveContextPath(path, context) {
  const trimmed = path.trim();
  if (!trimmed) return void 0;
  if (trimmed.startsWith("note.")) {
    return getNestedValue(context.note, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("file.")) {
    return getNestedValue(context.file, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("formula.")) {
    return getNestedValue(context.formula, trimmed.slice(8).split("."));
  }
  return getNestedValue(context.note, trimmed.split("."));
}
function getNestedValue(target, path) {
  let current = target;
  for (const part of path) {
    if (!part) continue;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return void 0;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return void 0;
    current = current[part];
  }
  return current;
}
function buildFileValue(path) {
  const normalized = path.trim();
  const lastSlash = normalized.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? normalized.slice(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf(".");
  const basename = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot + 1) : "";
  const folder = lastSlash >= 0 ? normalized.slice(0, lastSlash) : "";
  return {
    name: fileName || normalized,
    basename: basename || fileName || normalized,
    path: normalized,
    folder,
    ext,
    tags: [],
    links: []
  };
}
function getMethodTarget(value) {
  if (typeof value === "string") return "string";
  if (typeof value === "number" && !Number.isNaN(value)) return "number";
  if (isDateValue(value)) return "date";
  if (Array.isArray(value)) return "list";
  if (isFileValue(value)) return "file";
  if (isRecord(value)) return "object";
  return void 0;
}
registerGlobalFunction("if", ([cond, whenTrue, whenFalse]) => {
  return cond ? whenTrue : whenFalse;
});
registerGlobalFunction("contains", ([haystack, needle]) => {
  if (Array.isArray(haystack)) {
    if (haystack.includes(needle)) return true;
    const name = resolveSelfName(needle);
    return name ? listContainsName(haystack, name) : false;
  }
  if (typeof haystack === "string") return haystack.includes(toStringValue(needle));
  return false;
});
registerGlobalFunction("date", ([value]) => parseDate(value));
registerGlobalFunction("duration", ([value]) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseDuration(value);
  return void 0;
});
registerGlobalFunction("now", () => /* @__PURE__ */ new Date());
registerGlobalFunction("today", () => {
  const now = /* @__PURE__ */ new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
});
registerGlobalFunction("number", ([value]) => {
  const numberValue = toNumber(value);
  return numberValue === null ? void 0 : numberValue;
});
registerGlobalFunction("min", (args) => {
  const numbers = collectNumericArgs(args);
  if (numbers.length === 0) return void 0;
  return Math.min(...numbers);
});
registerGlobalFunction("max", (args) => {
  const numbers = collectNumericArgs(args);
  if (numbers.length === 0) return void 0;
  return Math.max(...numbers);
});
registerGlobalFunction("list", ([value]) => {
  if (value === void 0 || value === null) return [];
  if (Array.isArray(value)) return value;
  return [value];
});
registerGlobalFunction("link", ([path, display]) => {
  const target = isFileValue(path) ? path.path.replace(/\.md$/, "") : toStringValue(path);
  if (!target) return "";
  const label = isFileValue(display) ? display.basename : toStringValue(display);
  return label ? `[[${target}|${label}]]` : `[[${target}]]`;
});
registerGlobalFunction("image", ([path]) => {
  const target = isFileValue(path) ? path.path.replace(/\.md$/, "") : toStringValue(path);
  if (!target) return "";
  return `![[${target}]]`;
});
registerGlobalFunction("icon", ([name]) => {
  const value = toStringValue(name);
  if (!value) return "";
  return `:${value}:`;
});
registerGlobalFunction("html", ([value]) => toStringValue(value));
registerGlobalFunction("escapeHTML", ([value]) => {
  const text = toStringValue(value);
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
});
registerGlobalFunction("file", ([path]) => {
  if (typeof path !== "string") return void 0;
  if (!path.trim()) return void 0;
  return buildFileValue(path);
});
registerMethodFunction("file", "hasTag", (target, args) => {
  if (!isFileValue(target)) return false;
  if (args.length === 0) return false;
  return args.every((tag) => {
    const value = toStringValue(tag);
    if (!value) return false;
    if (target.tags.includes(value)) return true;
    const prefix = value.endsWith("/") ? value : `${value}/`;
    return target.tags.some((t) => t.startsWith(prefix));
  });
});
registerMethodFunction("file", "hasLink", (target, [link]) => {
  if (!isFileValue(target)) return false;
  const value = toStringValue(link);
  if (!value) return false;
  return target.links.includes(value);
});
registerMethodFunction("file", "inFolder", (target, [folder]) => {
  if (!isFileValue(target)) return false;
  const value = toStringValue(folder);
  if (!value) return false;
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  return target.folder === normalized || target.folder.startsWith(`${normalized}/`);
});
registerMethodFunction("file", "hasProperty", (_target, [prop], context) => {
  const value = toStringValue(prop);
  if (!value) return false;
  const resolved = resolveContextPath(value, context);
  return resolved !== void 0 && resolved !== null;
});
registerMethodFunction("string", "contains", (target, [needle]) => {
  const value = toStringValue(target);
  return value.includes(toStringValue(needle));
});
registerMethodFunction("string", "startsWith", (target, [prefix]) => {
  const value = toStringValue(target);
  return value.startsWith(toStringValue(prefix));
});
registerMethodFunction("string", "endsWith", (target, [suffix]) => {
  const value = toStringValue(target);
  return value.endsWith(toStringValue(suffix));
});
registerMethodFunction("string", "lower", (target) => toStringValue(target).toLowerCase());
registerMethodFunction("string", "upper", (target) => toStringValue(target).toUpperCase());
registerMethodFunction("string", "trim", (target) => toStringValue(target).trim());
registerMethodFunction("string", "replace", (target, [search, replacement]) => {
  const source = toStringValue(target);
  const needle = toStringValue(search);
  if (!needle) return source;
  const replacementText = toStringValue(replacement);
  return source.split(needle).join(replacementText);
});
registerMethodFunction("string", "slice", (target, [start, end]) => {
  const source = toStringValue(target);
  const startIndex = toInteger(start, 0);
  if (end === void 0) return source.slice(startIndex);
  const endIndex = toInteger(end, source.length);
  return source.slice(startIndex, endIndex);
});
registerMethodFunction("string", "isEmpty", (target) => toStringValue(target).length === 0);
registerMethodFunction("string", "repeat", (target, [count]) => {
  const source = toStringValue(target);
  const times = toInteger(count, 0);
  if (times <= 0) return "";
  return source.repeat(times);
});
registerMethodFunction(
  "string",
  "reverse",
  (target) => toStringValue(target).split("").reverse().join("")
);
registerMethodFunction("number", "toFixed", (target, [digits]) => {
  const value = toNumber(target);
  if (value === null) return void 0;
  const decimals = toInteger(digits, 0);
  return value.toFixed(decimals);
});
registerMethodFunction("number", "round", (target, [digits]) => {
  const value = toNumber(target);
  if (value === null) return void 0;
  const decimals = toInteger(digits, 0);
  return roundTo(value, decimals);
});
registerMethodFunction("number", "floor", (target) => {
  const value = toNumber(target);
  if (value === null) return void 0;
  return Math.floor(value);
});
registerMethodFunction("number", "ceil", (target) => {
  const value = toNumber(target);
  if (value === null) return void 0;
  return Math.ceil(value);
});
registerMethodFunction("number", "abs", (target) => {
  const value = toNumber(target);
  if (value === null) return void 0;
  return Math.abs(value);
});
function formatDateToken(date, token) {
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  const y = date.getFullYear();
  const M = date.getMonth() + 1;
  const d = date.getDate();
  const H = date.getHours();
  const h = H % 12 || 12;
  const m = date.getMinutes();
  const s = date.getSeconds();
  const A = H < 12 ? "AM" : "PM";
  switch (token) {
    case "YYYY":
      return String(y);
    case "YY":
      return String(y).slice(-2);
    case "MM":
      return pad(M);
    case "M":
      return String(M);
    case "DD":
      return pad(d);
    case "D":
      return String(d);
    case "HH":
      return pad(H);
    case "H":
      return String(H);
    case "hh":
      return pad(h);
    case "h":
      return String(h);
    case "mm":
      return pad(m);
    case "m":
      return String(m);
    case "ss":
      return pad(s);
    case "s":
      return String(s);
    case "A":
      return A;
    case "a":
      return A.toLowerCase();
    default:
      return token;
  }
}
function formatDate(date, format) {
  const tokenPattern = /YYYY|YY|MM|M|DD|D|HH|H|hh|h|mm|m|ss|s|A|a/g;
  let result = "";
  let lastIndex = 0;
  let match = tokenPattern.exec(format);
  while (match !== null) {
    result += format.slice(lastIndex, match.index);
    result += formatDateToken(date, match[0]);
    lastIndex = tokenPattern.lastIndex;
    match = tokenPattern.exec(format);
  }
  result += format.slice(lastIndex);
  return result;
}
registerMethodFunction("date", "format", (target, [format]) => {
  if (!isDateValue(target)) return void 0;
  const timestamp = target.getTime();
  if (Number.isNaN(timestamp)) return "";
  if (typeof format === "string" && format) {
    return formatDate(target, format);
  }
  return target.toISOString();
});
registerMethodFunction(
  "date",
  "year",
  (target) => isDateValue(target) ? target.getFullYear() : void 0
);
registerMethodFunction(
  "date",
  "month",
  (target) => isDateValue(target) ? target.getMonth() + 1 : void 0
);
registerMethodFunction(
  "date",
  "day",
  (target) => isDateValue(target) ? target.getDate() : void 0
);
registerMethodFunction("date", "date", (target) => {
  if (!isDateValue(target)) return void 0;
  const pad = (n, len = 2) => String(n).padStart(len, "0");
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
});
registerMethodFunction("date", "time", (target) => {
  if (!isDateValue(target)) return void 0;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(target.getHours())}:${pad(target.getMinutes())}:${pad(target.getSeconds())}`;
});
registerMethodFunction("date", "relative", (target) => {
  if (!isDateValue(target)) return void 0;
  const time = target.getTime();
  if (Number.isNaN(time)) return "";
  const diff = time - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 6e4);
  const hours = Math.round(abs / 36e5);
  const days = Math.round(abs / 864e5);
  if (days >= 1) return diff < 0 ? `${days}d ago` : `in ${days}d`;
  if (hours >= 1) return diff < 0 ? `${hours}h ago` : `in ${hours}h`;
  if (minutes >= 1) return diff < 0 ? `${minutes}m ago` : `in ${minutes}m`;
  return diff < 0 ? "just now" : "soon";
});
registerMethodFunction("date", "isEmpty", (target) => {
  if (!isDateValue(target)) return true;
  return Number.isNaN(target.getTime());
});
registerMethodFunction("list", "sum", (target) => {
  if (!Array.isArray(target)) return void 0;
  return target.reduce((total, item) => {
    const value = toNumber(item);
    return value === null ? total : total + value;
  }, 0);
});
registerMethodFunction("list", "mean", (target) => {
  if (!Array.isArray(target)) return void 0;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return void 0;
  const sum = numbers.reduce((total, value) => total + value, 0);
  return sum / numbers.length;
});
registerMethodFunction("list", "count", (target) => Array.isArray(target) ? target.length : 0);
registerMethodFunction("list", "min", (target) => {
  if (!Array.isArray(target)) return void 0;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return void 0;
  return Math.min(...numbers);
});
registerMethodFunction("list", "max", (target) => {
  if (!Array.isArray(target)) return void 0;
  const numbers = collectNumericArgs(target);
  if (numbers.length === 0) return void 0;
  return Math.max(...numbers);
});
registerMethodFunction("list", "round", (target, [digits]) => {
  if (!Array.isArray(target)) return void 0;
  const decimals = toInteger(digits, 0);
  return target.map((item) => {
    const numberValue = toNumber(item);
    if (numberValue === null) return item;
    return roundTo(numberValue, decimals);
  });
});
registerMethodFunction("file", "asLink", (target, args) => {
  if (!isFileValue(target)) return "";
  const path = target.path.replace(/\.md$/, "");
  const display = args.length > 0 ? toStringValue(args[0]) : "";
  return display ? `[[${path}|${display}]]` : `[[${path}]]`;
});
registerMethodFunction("string", "containsAll", (target, args) => {
  const value = toStringValue(target);
  return args.every((needle) => value.includes(toStringValue(needle)));
});
registerMethodFunction("string", "containsAny", (target, args) => {
  const value = toStringValue(target);
  return args.some((needle) => value.includes(toStringValue(needle)));
});
registerMethodFunction("string", "split", (target, [separator]) => {
  const value = toStringValue(target);
  const sep = toStringValue(separator);
  return value.split(sep);
});
registerMethodFunction("string", "title", (target) => {
  const value = toStringValue(target);
  return value.replace(/\b\w/g, (ch) => ch.toUpperCase());
});
registerMethodFunction("string", "asFile", (target, _args, context) => {
  const path = toStringValue(target);
  if (!path) return void 0;
  const lookup = context._fileLookup;
  if (lookup) {
    const normalized = path.trim();
    const found = lookup.get(normalized) ?? lookup.get(normalized.replace(/\.md$/, "")) ?? (!normalized.endsWith(".md") ? lookup.get(`${normalized}.md`) : void 0);
    if (found) return { ...found };
    const suffix = `/${normalized}`;
    const suffixMd = `/${normalized}.md`;
    for (const [key, value] of lookup) {
      if (key.endsWith(suffix) || key.endsWith(suffixMd)) {
        return { ...value };
      }
    }
  }
  return buildFileValue(path);
});
registerMethodFunction("list", "contains", (target, [needle]) => {
  if (!Array.isArray(target)) return false;
  if (target.includes(needle)) return true;
  const name = resolveSelfName(needle);
  return name ? listContainsName(target, name) : false;
});
registerMethodFunction("list", "containsAll", (target, args) => {
  if (!Array.isArray(target)) return false;
  return args.every((needle) => target.includes(needle));
});
registerMethodFunction("list", "containsAny", (target, args) => {
  if (!Array.isArray(target)) return false;
  return args.some((needle) => target.includes(needle));
});
registerMethodFunction("list", "flat", (target) => {
  if (!Array.isArray(target)) return void 0;
  return target.flat();
});
registerMethodFunction("list", "isEmpty", (target) => {
  if (!Array.isArray(target)) return true;
  return target.length === 0;
});
registerMethodFunction("list", "join", (target, [separator]) => {
  if (!Array.isArray(target)) return "";
  const sep = separator === void 0 ? ", " : toStringValue(separator);
  return target.map((item) => toStringValue(item)).join(sep);
});
registerMethodFunction("list", "reverse", (target) => {
  if (!Array.isArray(target)) return void 0;
  return [...target].reverse();
});
registerMethodFunction("list", "slice", (target, [start, end]) => {
  if (!Array.isArray(target)) return void 0;
  const startIndex = toInteger(start, 0);
  if (end === void 0) return target.slice(startIndex);
  const endIndex = toInteger(end, target.length);
  return target.slice(startIndex, endIndex);
});
registerMethodFunction("list", "sort", (target) => {
  if (!Array.isArray(target)) return void 0;
  return [...target].sort((a, b) => {
    if (typeof a === "number" && typeof b === "number") return a - b;
    return String(a).localeCompare(String(b));
  });
});
registerMethodFunction("list", "unique", (target) => {
  if (!Array.isArray(target)) return void 0;
  return [...new Set(target)];
});
registerMethodFunction("number", "isEmpty", (target) => {
  const value = toNumber(target);
  return value === null || Number.isNaN(value);
});
registerMethodFunction("object", "isEmpty", (target) => {
  if (!isRecord(target)) return true;
  return Object.keys(target).length === 0;
});
registerMethodFunction("object", "keys", (target) => {
  if (!isRecord(target)) return [];
  return Object.keys(target);
});
registerMethodFunction("object", "values", (target) => {
  if (!isRecord(target)) return [];
  return Object.values(target);
});
function registerAnyMethod(name, fn) {
  const targets = ["string", "number", "date", "list", "file", "object"];
  for (const target of targets) {
    registerMethodFunction(target, name, fn);
  }
}
registerAnyMethod("isTruthy", (target) => Boolean(target));
registerAnyMethod("isType", (target, [typeName]) => {
  const expected = toStringValue(typeName).toLowerCase();
  if (typeof target === "string") return expected === "string";
  if (typeof target === "number") return expected === "number";
  if (isDateValue(target)) return expected === "date";
  if (Array.isArray(target)) return expected === "list" || expected === "array";
  if (isFileValue(target)) return expected === "file";
  if (isRecord(target)) return expected === "object";
  return false;
});
registerAnyMethod("toString", (target) => {
  if (isDateValue(target)) return target.toISOString();
  if (Array.isArray(target)) return target.map((item) => toStringValue(item)).join(", ");
  if (isRecord(target)) return JSON.stringify(target);
  return toStringValue(target);
});

// src/compiler/interpreter.ts
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function toBoolean(value) {
  return Boolean(value);
}
function toNumber2(value) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}
function toStringValue2(value) {
  if (value === void 0 || value === null) return "";
  return String(value);
}
function compareValues(left, right, operator) {
  if (operator === "==") {
    if (isDateValue2(left) && isDateValue2(right)) return left.getTime() === right.getTime();
    return left === right;
  }
  if (operator === "!=") {
    if (isDateValue2(left) && isDateValue2(right)) return left.getTime() !== right.getTime();
    return left !== right;
  }
  if (isDateValue2(left) && isDateValue2(right)) {
    const leftMs = left.getTime();
    const rightMs = right.getTime();
    if (operator === ">") return leftMs > rightMs;
    if (operator === "<") return leftMs < rightMs;
    if (operator === ">=") return leftMs >= rightMs;
    if (operator === "<=") return leftMs <= rightMs;
  }
  const leftNum = toNumber2(left);
  const rightNum = toNumber2(right);
  if (leftNum !== null && rightNum !== null) {
    if (operator === ">") return leftNum > rightNum;
    if (operator === "<") return leftNum < rightNum;
    if (operator === ">=") return leftNum >= rightNum;
    if (operator === "<=") return leftNum <= rightNum;
  }
  const leftStr = toStringValue2(left);
  const rightStr = toStringValue2(right);
  if (operator === ">") return leftStr > rightStr;
  if (operator === "<") return leftStr < rightStr;
  if (operator === ">=") return leftStr >= rightStr;
  if (operator === "<=") return leftStr <= rightStr;
  return false;
}
function isDateValue2(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
function applyBinary(operator, left, right) {
  if (operator === "+") {
    if (isDateValue2(left) && typeof right === "number") {
      return new Date(left.getTime() + right);
    }
    if (typeof left === "number" && isDateValue2(right)) {
      return new Date(right.getTime() + left);
    }
    if (typeof left === "string" || typeof right === "string") {
      return `${toStringValue2(left)}${toStringValue2(right)}`;
    }
    const leftNum = toNumber2(left);
    const rightNum = toNumber2(right);
    if (leftNum === null || rightNum === null) return void 0;
    return leftNum + rightNum;
  }
  if (operator === "-") {
    if (isDateValue2(left) && typeof right === "number") {
      return new Date(left.getTime() - right);
    }
    if (isDateValue2(left) && isDateValue2(right)) {
      return left.getTime() - right.getTime();
    }
    const leftNum = toNumber2(left);
    const rightNum = toNumber2(right);
    if (leftNum === null || rightNum === null) return void 0;
    return leftNum - rightNum;
  }
  if (operator === "*") {
    const leftNum = toNumber2(left);
    const rightNum = toNumber2(right);
    if (leftNum === null || rightNum === null) return void 0;
    return leftNum * rightNum;
  }
  if (operator === "/") {
    const leftNum = toNumber2(left);
    const rightNum = toNumber2(right);
    if (leftNum === null || rightNum === null) return void 0;
    return rightNum === 0 ? 0 : leftNum / rightNum;
  }
  if (operator === "%") {
    const leftNum = toNumber2(left);
    const rightNum = toNumber2(right);
    if (leftNum === null || rightNum === null) return void 0;
    return rightNum === 0 ? 0 : leftNum % rightNum;
  }
  return compareValues(left, right, operator);
}
function getNestedValue2(target, path) {
  let current = target;
  for (const part of path) {
    if (!part) continue;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return void 0;
      current = current[index];
      continue;
    }
    if (!isRecord2(current)) return void 0;
    current = current[part];
  }
  return current;
}
function resolvePropertyValue(path, context) {
  if (typeof path !== "string") return void 0;
  const trimmed = path.trim();
  if (!trimmed) return void 0;
  if (trimmed.startsWith("this.")) {
    return getNestedValue2(context.self ?? {}, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("note.")) {
    return getNestedValue2(context.note, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("file.")) {
    return getNestedValue2(context.file, trimmed.slice(5).split("."));
  }
  if (trimmed.startsWith("formula.")) {
    return getNestedValue2(context.formula, trimmed.slice(8).split("."));
  }
  return getNestedValue2(context.note, trimmed.split("."));
}
function resolveIdentifier(name, context) {
  if (name.includes(".")) return resolvePropertyValue(name, context);
  if (name === "this") return context.self ?? {};
  if (name === "note") return context.note;
  if (name === "file") return context.file;
  if (name === "formula") return context.formula;
  if (name === "value") return context._lambdaValue;
  return context.note[name];
}
function resolveMember(target, name) {
  if (target === void 0 || target === null) return void 0;
  if (isDateValue2(target)) {
    switch (name) {
      case "year":
        return target.getFullYear();
      case "month":
        return target.getMonth() + 1;
      case "day":
        return target.getDate();
      case "hour":
        return target.getHours();
      case "minute":
        return target.getMinutes();
      case "second":
        return target.getSeconds();
      default:
        return void 0;
    }
  }
  if (Array.isArray(target)) {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return void 0;
    return target[index];
  }
  if (typeof target === "string") {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return void 0;
    return target.charAt(index);
  }
  if (isRecord2(target)) return target[name];
  return void 0;
}
function resolveIndex(target, indexValue) {
  if (target === void 0 || target === null) return void 0;
  if (Array.isArray(target)) {
    const index = toNumber2(indexValue);
    if (index === null) return void 0;
    return target[Math.trunc(index)];
  }
  if (typeof target === "string") {
    const index = toNumber2(indexValue);
    if (index === null) return void 0;
    return target.charAt(Math.trunc(index));
  }
  if (isRecord2(target)) {
    if (typeof indexValue === "string" || typeof indexValue === "number") {
      return target[String(indexValue)];
    }
  }
  return void 0;
}
function popArgs(stack, count) {
  const args = new Array(count);
  for (let i = count - 1; i >= 0; i -= 1) {
    args[i] = stack.pop();
  }
  return args;
}
function evaluateLambda(program, elementValue, context) {
  const lambdaContext = { ...context, _lambdaValue: elementValue };
  return interpret(program, lambdaContext);
}
function executeLazyMethod(name, target, argPrograms, context) {
  if (!Array.isArray(target)) return void 0;
  const body = argPrograms[0];
  if (!body) return void 0;
  switch (name) {
    case "filter":
      return target.filter((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "map":
      return target.map((element) => evaluateLambda(body, element, context));
    case "flatMap": {
      const mapped = target.map((element) => evaluateLambda(body, element, context));
      return mapped.flat();
    }
    case "find":
      return target.find((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "some":
      return target.some((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    case "every":
      return target.every((element) => {
        const result = evaluateLambda(body, element, context);
        return Boolean(result);
      });
    default:
      return void 0;
  }
}
function interpret(instructions, context) {
  const stack = [];
  let ip = 0;
  while (ip < instructions.length) {
    const instruction = instructions[ip];
    if (!instruction) break;
    switch (instruction.type) {
      case "Const":
        stack.push(instruction.value);
        ip += 1;
        break;
      case "Ident":
        stack.push(resolveIdentifier(instruction.name, context));
        ip += 1;
        break;
      case "LoadFormula":
        stack.push(context.formula[instruction.name]);
        ip += 1;
        break;
      case "Member": {
        const target = stack.pop();
        stack.push(resolveMember(target, instruction.name));
        ip += 1;
        break;
      }
      case "Index": {
        const indexValue = stack.pop();
        const target = stack.pop();
        stack.push(resolveIndex(target, indexValue));
        ip += 1;
        break;
      }
      case "List": {
        const items = popArgs(stack, instruction.count);
        stack.push(items);
        ip += 1;
        break;
      }
      case "Unary": {
        const value = stack.pop();
        if (instruction.operator === "!") {
          stack.push(!toBoolean(value));
        } else if (instruction.operator === "-") {
          const numberValue = toNumber2(value);
          stack.push(numberValue === null ? void 0 : -numberValue);
        } else {
          stack.push(void 0);
        }
        ip += 1;
        break;
      }
      case "Binary": {
        const right = stack.pop();
        const left = stack.pop();
        stack.push(applyBinary(instruction.operator, left, right));
        ip += 1;
        break;
      }
      case "ToBool": {
        const value = stack.pop();
        stack.push(toBoolean(value));
        ip += 1;
        break;
      }
      case "CallGlobal": {
        const args = popArgs(stack, instruction.argc);
        const fn = getGlobalFunction(instruction.name);
        if (!fn) {
          stack.push(void 0);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(args, context));
        } catch {
          stack.push(void 0);
        }
        ip += 1;
        break;
      }
      case "CallMethod": {
        const args = popArgs(stack, instruction.argc);
        const target = stack.pop();
        if ((target === null || target === void 0) && instruction.name === "isEmpty") {
          stack.push(true);
          ip += 1;
          break;
        }
        const fn = getMethodFunction(instruction.name, target);
        if (!fn) {
          stack.push(void 0);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(target, args, context));
        } catch {
          stack.push(void 0);
        }
        ip += 1;
        break;
      }
      case "CallMethodLazy": {
        const target = stack.pop();
        const result = executeLazyMethod(
          instruction.name,
          target,
          instruction.argPrograms,
          context
        );
        stack.push(result);
        ip += 1;
        break;
      }
      case "Jump":
        ip += instruction.offset;
        break;
      case "JumpIfFalse": {
        const value = stack.pop();
        if (!toBoolean(value)) {
          ip += instruction.offset;
        } else {
          ip += 1;
        }
        break;
      }
      case "JumpIfTrue": {
        const value = stack.pop();
        if (toBoolean(value)) {
          ip += instruction.offset;
        } else {
          ip += 1;
        }
        break;
      }
      default:
        ip += 1;
        break;
    }
  }
  return stack.pop();
}

// src/compiler/index.ts
function compile(expression) {
  const tokens = lex(expression);
  const ast = parse(tokens);
  return compileAst(ast);
}
function evaluate(expression, context) {
  try {
    const compiled = compile(expression);
    return interpret(compiled.instructions, context);
  } catch {
    return void 0;
  }
}
function evaluateFilter(node, context) {
  if (!node) return true;
  if (typeof node === "string") {
    return Boolean(evaluate(node, context));
  }
  if ("and" in node) {
    return node.and.every((child) => evaluateFilter(child, context));
  }
  if ("or" in node) {
    return node.or.some((child) => evaluateFilter(child, context));
  }
  if ("not" in node) {
    return !node.not.every((child) => evaluateFilter(child, context));
  }
  return true;
}

export { compile, evaluate, evaluateFilter, resolvePropertyValue };
//# sourceMappingURL=chunk-GIL63DBV.js.map
//# sourceMappingURL=chunk-GIL63DBV.js.map