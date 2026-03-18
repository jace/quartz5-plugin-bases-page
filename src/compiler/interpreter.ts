import { getGlobalFunction, getMethodFunction } from "./functions";
import type { Instruction } from "./ir";

export type EvalContext = {
  note: Record<string, unknown>;
  file: {
    name: string;
    path: string;
    folder: string;
    ext: string;
    tags: string[];
    links: string[];
    created?: string;
    modified?: string;
  };
  formula: Record<string, unknown>;
  self?: {
    file: {
      name: string;
      path: string;
      folder: string;
      ext: string;
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toBoolean(value: unknown): boolean {
  return Boolean(value);
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

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value);
}

function compareValues(left: unknown, right: unknown, operator: string): boolean {
  if (operator === "==") return left === right;
  if (operator === "!=") return left !== right;

  const leftNum = toNumber(left);
  const rightNum = toNumber(right);
  if (leftNum !== null && rightNum !== null) {
    if (operator === ">") return leftNum > rightNum;
    if (operator === "<") return leftNum < rightNum;
    if (operator === ">=") return leftNum >= rightNum;
    if (operator === "<=") return leftNum <= rightNum;
  }

  const leftStr = toStringValue(left);
  const rightStr = toStringValue(right);
  if (operator === ">") return leftStr > rightStr;
  if (operator === "<") return leftStr < rightStr;
  if (operator === ">=") return leftStr >= rightStr;
  if (operator === "<=") return leftStr <= rightStr;
  return false;
}

function applyBinary(operator: string, left: unknown, right: unknown): unknown {
  if (operator === "+") {
    if (typeof left === "string" || typeof right === "string") {
      return `${toStringValue(left)}${toStringValue(right)}`;
    }
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum + rightNum;
  }

  if (operator === "-") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum - rightNum;
  }

  if (operator === "*") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return leftNum * rightNum;
  }

  if (operator === "/") {
    const leftNum = toNumber(left);
    const rightNum = toNumber(right);
    if (leftNum === null || rightNum === null) return undefined;
    return rightNum === 0 ? 0 : leftNum / rightNum;
  }

  return compareValues(left, right, operator);
}

function getNestedValue(target: unknown, path: string[]): unknown {
  let current: unknown = target;
  for (const part of path) {
    if (!part) continue;
    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

export function resolvePropertyValue(path: string, context: EvalContext): unknown {
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("this.")) {
    return getNestedValue(context.self ?? {}, trimmed.slice(5).split("."));
  }
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

function resolveIdentifier(name: string, context: EvalContext): unknown {
  if (name.includes(".")) return resolvePropertyValue(name, context);
  if (name === "this") return context.self ?? {};
  if (name === "note") return context.note;
  if (name === "file") return context.file;
  if (name === "formula") return context.formula;
  return context.note[name];
}

function resolveMember(target: unknown, name: string): unknown {
  if (target === undefined || target === null) return undefined;
  if (Array.isArray(target)) {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return undefined;
    return target[index];
  }
  if (typeof target === "string") {
    if (name === "length") return target.length;
    const index = Number(name);
    if (Number.isNaN(index)) return undefined;
    return target.charAt(index);
  }
  if (isRecord(target)) return target[name];
  return undefined;
}

function resolveIndex(target: unknown, indexValue: unknown): unknown {
  if (target === undefined || target === null) return undefined;
  if (Array.isArray(target)) {
    const index = toNumber(indexValue);
    if (index === null) return undefined;
    return target[Math.trunc(index)];
  }
  if (typeof target === "string") {
    const index = toNumber(indexValue);
    if (index === null) return undefined;
    return target.charAt(Math.trunc(index));
  }
  if (isRecord(target)) {
    if (typeof indexValue === "string" || typeof indexValue === "number") {
      return target[String(indexValue)];
    }
  }
  return undefined;
}

function popArgs(stack: unknown[], count: number): unknown[] {
  const args = new Array<unknown>(count);
  for (let i = count - 1; i >= 0; i -= 1) {
    args[i] = stack.pop();
  }
  return args;
}

export function interpret(instructions: Instruction[], context: EvalContext): unknown {
  const stack: unknown[] = [];
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
          const numberValue = toNumber(value);
          stack.push(numberValue === null ? undefined : -numberValue);
        } else {
          stack.push(undefined);
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
          stack.push(undefined);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(args, context));
        } catch {
          stack.push(undefined);
        }
        ip += 1;
        break;
      }
      case "CallMethod": {
        const args = popArgs(stack, instruction.argc);
        const target = stack.pop();
        const fn = getMethodFunction(instruction.name, target);
        if (!fn) {
          stack.push(undefined);
          ip += 1;
          break;
        }
        try {
          stack.push(fn(target, args, context));
        } catch {
          stack.push(undefined);
        }
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
