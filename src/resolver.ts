import type { BasesData, BasesEntry, BasesView, QuartzPluginData } from "./types";
import { evaluate, evaluateFilter, resolvePropertyValue } from "./compiler";
import type { EvalContext } from "./compiler";

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.filter((value): value is string => typeof value === "string");
}

function getFilePath(fileData: QuartzPluginData, slug: string): string {
  // Prefer relativePath (relative to content dir) over filePath (absolute).
  // Self-context paths from .base files use ctx.allFiles which are relative,
  // so note paths must also be relative for inFolder() comparisons to work.
  if (typeof fileData.relativePath === "string") return fileData.relativePath;
  if (typeof fileData.filePath === "string") return fileData.filePath;
  return slug ? `${slug}.md` : "";
}

function getBaseName(path: string): string {
  const lastSlash = path.lastIndexOf("/");
  const base = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function buildFileProperties(
  fileData: QuartzPluginData,
  slug: string,
  frontmatter: Record<string, unknown>,
): BasesEntry["fileProperties"] {
  const filePath = getFilePath(fileData, slug);
  const baseName = filePath ? getBaseName(filePath) : getBaseName(slug);
  const name = baseName || slug.split("/").pop() || "Untitled";
  const lastSlash = filePath.lastIndexOf("/");
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot + 1) : "";
  const tags = normalizeStringArray(frontmatter.tags);
  const links = normalizeStringArray(fileData.links ?? fileData.outgoingLinks);

  // Extract dates from file data if available
  const dates = fileData.dates as Record<string, unknown> | undefined;
  const created =
    typeof dates?.created === "string"
      ? dates.created
      : dates?.created instanceof Date
        ? dates.created.toISOString()
        : undefined;
  const modified =
    typeof dates?.modified === "string"
      ? dates.modified
      : dates?.modified instanceof Date
        ? dates.modified.toISOString()
        : undefined;

  return {
    name,
    path: filePath,
    folder,
    ext,
    tags,
    links,
    created,
    modified,
  };
}

function compareSort(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === undefined || a === null) return 1;
  if (b === undefined || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const dateA = typeof a === "string" ? Date.parse(a) : NaN;
  const dateB = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return String(a).localeCompare(String(b));
}

function sortEntries(entries: BasesEntry[], view?: BasesView): BasesEntry[] {
  const sortProperty = view?.groupBy?.property ?? view?.order?.[0];
  if (!sortProperty) return entries;
  const direction = view?.groupBy?.direction ?? "ASC";
  const sign = direction === "DESC" ? -1 : 1;

  return [...entries].sort((left, right) => {
    const leftValue = resolvePropertyValue(sortProperty, {
      note: left.properties,
      file: left.fileProperties,
      formula: left.formulaValues,
    });
    const rightValue = resolvePropertyValue(sortProperty, {
      note: right.properties,
      file: right.fileProperties,
      formula: right.formulaValues,
    });
    return sign * compareSort(leftValue, rightValue);
  });
}

export function resolveBasesEntries(
  basesData: BasesData,
  allFiles: QuartzPluginData[],
  view?: BasesView,
  selfContext?: EvalContext["self"],
): { entries: BasesEntry[]; total: number } {
  const entries: BasesEntry[] = [];
  const formulas = basesData.formulas ?? {};

  for (const fileData of allFiles) {
    const slug = typeof fileData.slug === "string" ? fileData.slug : "";
    if (!slug) continue;

    const filePath = typeof fileData.filePath === "string" ? fileData.filePath : "";
    if (filePath.endsWith(".base") || slug.endsWith(".base")) continue;

    const frontmatter = (fileData.frontmatter ?? {}) as Record<string, unknown>;
    const fileProperties = buildFileProperties(fileData, slug, frontmatter);
    const context = {
      note: frontmatter,
      file: fileProperties,
      formula: {} as Record<string, unknown>,
      self: selfContext,
    };

    // Evaluate formulas
    for (const [name, expr] of Object.entries(formulas)) {
      context.formula[name] = evaluate(expr, context);
    }

    // Apply global filters
    if (!evaluateFilter(basesData.filters, context)) continue;
    // Apply view-specific filters
    if (view?.filters && !evaluateFilter(view.filters, context)) continue;

    const title =
      typeof frontmatter.title === "string"
        ? frontmatter.title
        : fileProperties.name || slug.split("/").pop() || "Untitled";

    entries.push({
      slug,
      title,
      properties: frontmatter,
      fileProperties,
      formulaValues: context.formula,
    });
  }

  const total = entries.length;
  const sorted = sortEntries(entries, view);
  const limited = view?.limit ? sorted.slice(0, view.limit) : sorted;
  return { entries: limited, total };
}
