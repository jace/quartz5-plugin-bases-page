import type { BasesEntry, FilterNode } from "./types";

export type EvalContext = {
  note: Record<string, unknown>;
  file: BasesEntry["fileProperties"];
  formula: Record<string, unknown>;
};

function stripOuterParens(value: string): string {
  let trimmed = value.trim();
  let changed = true;
  while (changed) {
    changed = false;
    if (!trimmed.startsWith("(") || !trimmed.endsWith(")")) break;
    let depth = 0;
    let inQuote: string | null = null;
    let valid = true;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i] ?? "";
      if (inQuote) {
        if (ch === inQuote && trimmed[i - 1] !== "\\") inQuote = null;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inQuote = ch;
        continue;
      }
      if (ch === "(") depth += 1;
      if (ch === ")") depth -= 1;
      if (depth === 0 && i < trimmed.length - 1) {
        valid = false;
        break;
      }
    }
    if (valid) {
      trimmed = trimmed.slice(1, -1).trim();
      changed = true;
    }
  }
  return trimmed;
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i] ?? "";
    if (quote) {
      current += ch;
      if (ch === quote && input[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }
    if (depth === 0 && input.startsWith(delimiter, i)) {
      result.push(current.trim());
      current = "";
      i += delimiter.length - 1;
      continue;
    }
    current += ch;
  }

  result.push(current.trim());
  return result;
}

function parseStringLiteral(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) return null;
  const quote = trimmed[0];
  if ((quote !== '"' && quote !== "'") || trimmed[trimmed.length - 1] !== quote) {
    return null;
  }
  return trimmed.slice(1, -1).replace(/\\([\\"'])/g, "$1");
}

function parseNumberLiteral(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isNaN(num) ? null : num;
}

function getNestedValue(target: unknown, path: string[]): unknown {
  let current: unknown = target;
  for (const part of path) {
    if (!part) continue;
    if (!current || typeof current !== "object") return undefined;
    const record = current as Record<string, unknown>;
    current = record[part];
  }
  return current;
}

export function resolvePropertyValue(path: string, context: EvalContext): unknown {
  const trimmed = path.trim();
  if (!trimmed) return undefined;
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

function parseFunctionCall(expression: string): { name: string; args: string[] } | null {
  const trimmed = expression.trim();
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i] ?? "";
    if (quote) {
      if (ch === quote && trimmed[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      if (depth === 1) {
        const name = trimmed.slice(0, i).trim();
        const inner = trimmed.slice(i + 1, -1);
        if (!trimmed.endsWith(")")) return null;
        const args = splitTopLevel(inner, ",").filter((arg) => arg.length > 0);
        return { name, args };
      }
    }
    if (ch === ")") depth -= 1;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return null;
}

function compareValues(left: unknown, right: unknown, op: string): boolean {
  if (op === "==") return left === right;
  if (op === "!=") return left !== right;

  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  if (leftNum !== null && rightNum !== null) {
    if (op === ">") return leftNum > rightNum;
    if (op === "<") return leftNum < rightNum;
    if (op === ">=") return leftNum >= rightNum;
    if (op === "<=") return leftNum <= rightNum;
  }

  const leftStr = left === undefined || left === null ? "" : String(left);
  const rightStr = right === undefined || right === null ? "" : String(right);
  if (op === ">") return leftStr > rightStr;
  if (op === "<") return leftStr < rightStr;
  if (op === ">=") return leftStr >= rightStr;
  if (op === "<=") return leftStr <= rightStr;
  return false;
}

function findComparison(expression: string): { left: string; right: string; op: string } | null {
  const operators = [">=", "<=", "==", "!=", ">", "<"];
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i] ?? "";
    if (quote) {
      if (ch === quote && expression[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth !== 0) continue;
    for (const op of operators) {
      if (expression.startsWith(op, i)) {
        const left = expression.slice(0, i).trim();
        const right = expression.slice(i + op.length).trim();
        return { left, right, op };
      }
    }
  }
  return null;
}

function evaluateFunction(name: string, args: string[], context: EvalContext): unknown {
  if (name === "if") {
    const [cond, whenTrue, whenFalse] = args;
    if (!cond) return undefined;
    const condition = evaluateExpression(cond, context);
    return condition
      ? evaluateExpression(whenTrue ?? "", context)
      : evaluateExpression(whenFalse ?? "", context);
  }

  if (name === "contains") {
    if (args.length < 2) return false;
    const target = evaluateExpression(args[0] ?? "", context);
    const needle = evaluateExpression(args[1] ?? "", context);
    if (Array.isArray(target)) return target.includes(needle as never);
    if (typeof target === "string") return target.includes(String(needle ?? ""));
    return false;
  }

  if (name === "file.hasTag") {
    const tag = args[0] ? String(evaluateExpression(args[0], context)) : "";
    return context.file.tags.includes(tag);
  }

  if (name === "file.hasLink") {
    const link = args[0] ? String(evaluateExpression(args[0], context)) : "";
    return context.file.links.includes(link);
  }

  if (name === "file.inFolder") {
    const folder = args[0] ? String(evaluateExpression(args[0], context)) : "";
    if (!folder) return false;
    const normalized = folder.endsWith("/") ? folder.slice(0, -1) : folder;
    return context.file.folder === normalized || context.file.folder.startsWith(`${normalized}/`);
  }

  if (name === "file.hasProperty") {
    const prop = args[0] ? String(evaluateExpression(args[0], context)) : "";
    if (!prop) return false;
    const value = resolvePropertyValue(prop, context);
    return value !== undefined && value !== null;
  }

  return undefined;
}

function parseBinaryOperators(
  expression: string,
  operators: string[],
  evalTerm: (value: string) => unknown,
): { handled: boolean; value: unknown } {
  const parts: string[] = [];
  const ops: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | null = null;

  const operatorSet = new Set(operators);

  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i] ?? "";
    if (quote) {
      current += ch;
      if (ch === quote && expression[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") {
      depth += 1;
      current += ch;
      continue;
    }
    if (ch === ")") {
      depth -= 1;
      current += ch;
      continue;
    }

    if (depth === 0 && operatorSet.has(ch)) {
      const prev = current.trim().slice(-1);
      if ((ch === "+" || ch === "-") && (prev === "" || "+-*/(,".includes(prev))) {
        current += ch;
        continue;
      }
      parts.push(current.trim());
      ops.push(ch);
      current = "";
      continue;
    }

    current += ch;
  }

  parts.push(current.trim());
  if (ops.length === 0) return { handled: false, value: undefined };

  let value = evalTerm(parts[0] ?? "");
  for (let i = 0; i < ops.length; i += 1) {
    const right = evalTerm(parts[i + 1] ?? "");
    const op = ops[i];
    if (op === "+") {
      if (typeof value === "string" || typeof right === "string") {
        value = `${value ?? ""}${right ?? ""}`;
      } else {
        const leftNum = toNumber(value);
        const rightNum = toNumber(right);
        if (leftNum === null || rightNum === null) return { handled: true, value: undefined };
        value = leftNum + rightNum;
      }
    }
    if (op === "-") {
      const leftNum = toNumber(value);
      const rightNum = toNumber(right);
      if (leftNum === null || rightNum === null) return { handled: true, value: undefined };
      value = leftNum - rightNum;
    }
    if (op === "*") {
      const leftNum = toNumber(value);
      const rightNum = toNumber(right);
      if (leftNum === null || rightNum === null) return { handled: true, value: undefined };
      value = leftNum * rightNum;
    }
    if (op === "/") {
      const leftNum = toNumber(value);
      const rightNum = toNumber(right);
      if (leftNum === null || rightNum === null) return { handled: true, value: undefined };
      value = rightNum === 0 ? 0 : leftNum / rightNum;
    }
  }

  return { handled: true, value };
}

function evaluateExpression(expression: string, context: EvalContext): unknown {
  const trimmed = stripOuterParens(expression.trim());
  if (!trimmed) return undefined;

  const orParts = splitTopLevel(trimmed, "||");
  if (orParts.length > 1) {
    return orParts.some((part) => Boolean(evaluateExpression(part, context)));
  }

  const andParts = splitTopLevel(trimmed, "&&");
  if (andParts.length > 1) {
    return andParts.every((part) => Boolean(evaluateExpression(part, context)));
  }

  if (trimmed.startsWith("!") && !trimmed.startsWith("!=")) {
    return !Boolean(evaluateExpression(trimmed.slice(1), context));
  }

  const comparison = findComparison(trimmed);
  if (comparison) {
    const left = evaluateExpression(comparison.left, context);
    const right = evaluateExpression(comparison.right, context);
    return compareValues(left, right, comparison.op);
  }

  const addSub = parseBinaryOperators(trimmed, ["+", "-"], (value) =>
    evaluateExpression(value, context),
  );
  if (addSub.handled) return addSub.value;

  const mulDiv = parseBinaryOperators(trimmed, ["*", "/"], (value) =>
    evaluateExpression(value, context),
  );
  if (mulDiv.handled) return mulDiv.value;

  const func = parseFunctionCall(trimmed);
  if (func) {
    return evaluateFunction(func.name, func.args, context);
  }

  const literal = parseStringLiteral(trimmed);
  if (literal !== null) return literal;

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;

  const numeric = parseNumberLiteral(trimmed);
  if (numeric !== null) return numeric;

  return resolvePropertyValue(trimmed, context);
}

export function evaluateFilterNode(node: FilterNode | undefined, context: EvalContext): boolean {
  if (!node) return true;
  if (typeof node === "string") {
    const result = evaluateExpression(node, context);
    return Boolean(result);
  }
  if ("and" in node) {
    return node.and.every((child) => evaluateFilterNode(child, context));
  }
  if ("or" in node) {
    return node.or.some((child) => evaluateFilterNode(child, context));
  }
  if ("not" in node) {
    return !node.not.every((child) => evaluateFilterNode(child, context));
  }
  return true;
}

export function evaluateFormulaExpression(expression: string, context: EvalContext): unknown {
  try {
    const value = evaluateExpression(expression, context);
    return value === undefined ? expression : value;
  } catch {
    return expression;
  }
}
