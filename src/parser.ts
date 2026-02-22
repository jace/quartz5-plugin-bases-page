import { parse } from "yaml";
import type { BasesData, BasesView } from "./types";

function extractBaseBlock(raw: string): string | null {
  const lines = raw.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = (lines[i] ?? "").trim();
    if (!trimmed.startsWith("```")) continue;
    const lang = trimmed.slice(3).trim();
    if (lang === "base") {
      start = i + 1;
      break;
    }
  }

  if (start === -1) return null;

  let end = -1;
  for (let i = start; i < lines.length; i += 1) {
    if ((lines[i] ?? "").trim().startsWith("```")) {
      end = i;
      break;
    }
  }

  if (end === -1) return null;
  return lines.slice(start, end).join("\n");
}

function normalizeViews(views: unknown): BasesView[] | null | undefined {
  if (views === undefined) return undefined;
  if (!Array.isArray(views)) return null;

  const normalized = views
    .map((view) => {
      if (!view || typeof view !== "object" || Array.isArray(view)) return null;
      const record = view as Record<string, unknown>;
      if (typeof record.type !== "string") return null;
      return record as BasesView;
    })
    .filter((view): view is BasesView => view !== null);

  return normalized;
}

export function parseBasesData(raw: string): BasesData | null {
  const block = extractBaseBlock(raw);
  const content = block ?? raw;

  let data: unknown;
  try {
    data = parse(content);
  } catch {
    return null;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const views = normalizeViews(record.views);
  if (views === null) return null;

  return {
    ...(record as BasesData),
    views,
  };
}
