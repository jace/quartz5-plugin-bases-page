import type { ComponentChild } from "preact";

import { slugifyPath } from "@quartz-community/utils";

import type { BasesView } from "../types";

/**
 * A stable, URL-fragment-friendly slug for a view, derived from its display
 * name (falling back to its type). Used as the `#hash` deep-link target so a
 * link like `.../foo.base#map` opens the "Map" tab. Uses Quartz's own
 * `slugifyPath` for consistency with the rest of the site's slugs/anchors.
 */
export function viewSlug(view: BasesView, index: number): string {
  const raw = view.name ?? view.type ?? "";
  return slugifyPath(raw) || `view-${index + 1}`;
}

export interface ViewSelectorProps {
  views: BasesView[];
  activeIndex: number;
  locale: string;
}

export function ViewSelector({ views, activeIndex }: ViewSelectorProps): ComponentChild {
  if (views.length <= 1) return null;

  return (
    <div class="bases-view-tabs" role="tablist">
      {views.map((view, index) => (
        <button
          type="button"
          class={index === activeIndex ? "is-active" : ""}
          data-view-index={index}
          data-view-slug={viewSlug(view, index)}
        >
          {view.name ?? view.type}
        </button>
      ))}
    </div>
  );
}
