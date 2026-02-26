import type { ComponentChild } from "preact";

import { resolveRelative } from "../../util/path";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const MDLINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
const URL_RE = /https?:\/\/[^\s<>]+/g;

type RenderCtx = { slug: string };

export function renderTextWithLinks(text: string, ctx: RenderCtx): ComponentChild[] {
  const segments: { start: number; end: number; node: ComponentChild }[] = [];
  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = match[1] ?? "";
    const display = match[2] ?? target;
    const href = resolveRelative(ctx.slug, target);
    segments.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      node: (
        <a href={href} class="internal">
          {display}
        </a>
      ),
    });
  }

  for (const match of text.matchAll(MDLINK_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const overlaps = segments.some((segment) => start < segment.end && end > segment.start);
    if (overlaps) continue;
    const display = match[1] ?? "";
    const href = match[2] ?? "";
    const isExternal = href.startsWith("http://") || href.startsWith("https://");
    const resolvedHref = isExternal ? href : resolveRelative(ctx.slug, href);
    segments.push({
      start,
      end,
      node: (
        <a
          href={resolvedHref}
          class={isExternal ? "external" : "internal"}
          {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {display || href}
        </a>
      ),
    });
  }

  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    const overlaps = segments.some((segment) => start < segment.end && end > segment.start);
    if (overlaps) continue;
    segments.push({
      start,
      end,
      node: (
        <a href={match[0]} class="external" target="_blank" rel="noopener noreferrer">
          {match[0]}
        </a>
      ),
    });
  }

  if (segments.length === 0) return [text];

  segments.sort((a, b) => a.start - b.start);

  const result: ComponentChild[] = [];
  let cursor = 0;
  for (const segment of segments) {
    if (segment.start > cursor) {
      result.push(text.slice(cursor, segment.start));
    }
    result.push(segment.node);
    cursor = segment.end;
  }
  if (cursor < text.length) {
    result.push(text.slice(cursor));
  }
  return result;
}
