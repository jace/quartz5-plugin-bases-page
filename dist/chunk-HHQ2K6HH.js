import { viewRegistry, registerCustomViews } from './chunk-LHVPD2IS.js';
import { evaluate, evaluateFilter, resolvePropertyValue } from './chunk-RBP2NPYV.js';
import { jsx, jsxs, Fragment } from 'preact/jsx-runtime';

function ViewSelector({ views, activeIndex }) {
  if (views.length <= 1) return null;
  return /* @__PURE__ */ jsx("div", { class: "bases-view-tabs", role: "tablist", children: views.map((view, index) => /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      class: index === activeIndex ? "is-active" : "",
      "data-view-index": index,
      children: view.name ?? view.type
    }
  )) });
}

// src/resolver.ts
function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values.filter((value) => typeof value === "string");
}
function getFilePath(fileData, slug) {
  if (typeof fileData.filePath === "string") return fileData.filePath;
  return slug ? `${slug}.md` : "";
}
function getBaseName(path) {
  const lastSlash = path.lastIndexOf("/");
  const base = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}
function buildFileProperties(fileData, slug, frontmatter) {
  const filePath = getFilePath(fileData, slug);
  const baseName = filePath ? getBaseName(filePath) : getBaseName(slug);
  const name = baseName || slug.split("/").pop() || "Untitled";
  const lastSlash = filePath.lastIndexOf("/");
  const folder = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const lastDot = filePath.lastIndexOf(".");
  const ext = lastDot >= 0 ? filePath.slice(lastDot + 1) : "";
  const tags = normalizeStringArray(frontmatter.tags);
  const links = normalizeStringArray(fileData.links ?? fileData.outgoingLinks);
  const dates = fileData.dates;
  const created = typeof dates?.created === "string" ? dates.created : dates?.created instanceof Date ? dates.created.toISOString() : void 0;
  const modified = typeof dates?.modified === "string" ? dates.modified : dates?.modified instanceof Date ? dates.modified.toISOString() : void 0;
  return {
    name,
    path: filePath,
    folder,
    ext,
    tags,
    links,
    created,
    modified
  };
}
function compareSort(a, b) {
  if (a === b) return 0;
  if (a === void 0 || a === null) return 1;
  if (b === void 0 || b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const dateA = typeof a === "string" ? Date.parse(a) : NaN;
  const dateB = typeof b === "string" ? Date.parse(b) : NaN;
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return String(a).localeCompare(String(b));
}
function sortEntries(entries, view) {
  const sortProperty = view?.groupBy?.property ?? view?.order?.[0];
  if (!sortProperty) return entries;
  const direction = view?.groupBy?.direction ?? "ASC";
  const sign = direction === "DESC" ? -1 : 1;
  return [...entries].sort((left, right) => {
    const leftValue = resolvePropertyValue(sortProperty, {
      note: left.properties,
      file: left.fileProperties,
      formula: left.formulaValues
    });
    const rightValue = resolvePropertyValue(sortProperty, {
      note: right.properties,
      file: right.fileProperties,
      formula: right.formulaValues
    });
    return sign * compareSort(leftValue, rightValue);
  });
}
function resolveBasesEntries(basesData, allFiles, view) {
  const entries = [];
  const formulas = basesData.formulas ?? {};
  for (const fileData of allFiles) {
    const slug = typeof fileData.slug === "string" ? fileData.slug : "";
    if (!slug) continue;
    const filePath = typeof fileData.filePath === "string" ? fileData.filePath : "";
    if (filePath.endsWith(".base") || slug.endsWith(".base")) continue;
    const frontmatter = fileData.frontmatter ?? {};
    const fileProperties = buildFileProperties(fileData, slug, frontmatter);
    const context = {
      note: frontmatter,
      file: fileProperties,
      formula: {}
    };
    for (const [name, expr] of Object.entries(formulas)) {
      context.formula[name] = evaluate(expr, context);
    }
    if (!evaluateFilter(basesData.filters, context)) continue;
    if (view?.filters && !evaluateFilter(view.filters, context)) continue;
    const title = typeof frontmatter.title === "string" ? frontmatter.title : fileProperties.name || slug.split("/").pop() || "Untitled";
    entries.push({
      slug,
      title,
      properties: frontmatter,
      fileProperties,
      formulaValues: context.formula
    });
  }
  const total = entries.length;
  const sorted = sortEntries(entries, view);
  const limited = view?.limit ? sorted.slice(0, view.limit) : sorted;
  return { entries: limited, total };
}

// src/i18n/locales/en-US.ts
var en_US_default = {
  components: {
    bases: {
      title: "Base",
      noData: "No data found.",
      noViews: "No views defined.",
      mapPlaceholder: "Map view is not available in static builds.",
      allNotes: "All notes",
      allEntries: "All entries",
      galleryView: "Gallery",
      boardView: "Board",
      noImage: "No image available",
      uncategorized: "Uncategorized",
      showingCount: "Showing {count} of {total} entries"
    }
  }
};

// src/i18n/index.ts
var locales = {
  "en-US": en_US_default
};
function i18n(locale) {
  return locales[locale] || en_US_default;
}

// src/util/path.ts
function simplifySlug(slug) {
  if (slug.endsWith("/index")) return slug.slice(0, -6);
  return slug;
}
function resolveRelative(current, target) {
  const simpleCurrent = simplifySlug(current);
  const simpleTarget = simplifySlug(target);
  const currentParts = simpleCurrent.split("/").filter(Boolean);
  const targetParts = simpleTarget.split("/").filter(Boolean);
  currentParts.pop();
  let prefix = "";
  const commonLength = Math.min(currentParts.length, targetParts.length);
  let common = 0;
  for (let i = 0; i < commonLength; i++) {
    if (currentParts[i] === targetParts[i]) {
      common++;
    } else {
      break;
    }
  }
  const ups = currentParts.length - common;
  if (ups > 0) {
    prefix = "../".repeat(ups);
  } else {
    prefix = "./";
  }
  return prefix + targetParts.slice(common).join("/");
}
var WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
var MDLINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;
var URL_RE = /https?:\/\/[^\s<>]+/g;
function renderTextWithLinks(text, ctx) {
  const segments = [];
  for (const match of text.matchAll(WIKILINK_RE)) {
    const target = match[1] ?? "";
    const display = match[2] ?? target;
    const href = resolveRelative(ctx.slug, target);
    segments.push({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      node: /* @__PURE__ */ jsx("a", { href, class: "internal", children: display })
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
      node: /* @__PURE__ */ jsx(
        "a",
        {
          href: resolvedHref,
          class: isExternal ? "external" : "internal",
          ...isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {},
          children: display || href
        }
      )
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
      node: /* @__PURE__ */ jsx("a", { href: match[0], class: "external", target: "_blank", rel: "noopener noreferrer", children: match[0] })
    });
  }
  if (segments.length === 0) return [text];
  segments.sort((a, b) => a.start - b.start);
  const result = [];
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
function formatValue(value) {
  if (value === void 0 || value === null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
function renderCellValue(value, ctx) {
  if (value === null || value === void 0) {
    return /* @__PURE__ */ jsx("span", { class: "bases-empty", children: "\u2014" });
  }
  if (typeof value === "boolean") {
    return /* @__PURE__ */ jsx("input", { type: "checkbox", checked: value, disabled: true });
  }
  if (typeof value === "number") {
    return /* @__PURE__ */ jsx("span", { class: "bases-number", children: value });
  }
  if (typeof value === "string") {
    const parts = renderTextWithLinks(value, ctx);
    return /* @__PURE__ */ jsx("span", { class: "bases-text", children: parts });
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => /* @__PURE__ */ jsxs(Fragment, { children: [
      index > 0 && /* @__PURE__ */ jsx("span", { class: "bases-separator", children: ", " }),
      renderCellValue(item, ctx)
    ] }));
    return /* @__PURE__ */ jsx("span", { class: "bases-list", children: items });
  }
  if (typeof value === "object") {
    return /* @__PURE__ */ jsx("code", { children: JSON.stringify(value) });
  }
  return String(value);
}
function isEmptyValue(value) {
  if (value === void 0 || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
function getColumnLabel(column, basesData) {
  const config = basesData.properties?.[column];
  if (config?.displayName) return config.displayName;
  const segment = column.split(".").pop() ?? column;
  return segment.split("_").map((part) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part).join(" ");
}
function getColumns(view, basesData, entries) {
  if (view.order && view.order.length > 0) return view.order;
  const columns = /* @__PURE__ */ new Set();
  columns.add("file.name");
  const propertyKeys = basesData.properties ? Object.keys(basesData.properties) : [];
  if (propertyKeys.length > 0) {
    propertyKeys.forEach((key) => {
      columns.add(key);
    });
  } else if (entries.length > 0) {
    const firstEntry = entries[0];
    if (firstEntry) {
      Object.keys(firstEntry.properties).forEach((key) => {
        columns.add(key);
      });
    }
  }
  return Array.from(columns);
}
function getNestedValue(value, path) {
  let current = value;
  for (const segment of path) {
    if (segment === "") continue;
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (Number.isNaN(index)) return void 0;
      current = current[index];
      continue;
    }
    if (current && typeof current === "object") {
      const record = current;
      current = record[segment];
      continue;
    }
    return void 0;
  }
  return current;
}
function resolveEntryPropertyValue(column, entry) {
  if (column.startsWith("note.")) {
    return getNestedValue(entry.properties, column.slice(5).split("."));
  }
  if (column.startsWith("file.")) {
    return getNestedValue(entry.fileProperties, column.slice(5).split("."));
  }
  if (column.startsWith("formula.")) {
    return getNestedValue(entry.formulaValues, column.slice(8).split("."));
  }
  return getNestedValue(entry.properties, column.split("."));
}
function formatMessage(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var BoardView = ({ entries, view, basesData, total, locale }) => {
  const localeStrings = i18n(locale).components.bases;
  const groupProperty = view.groupBy?.property ?? view.boardProperty;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== groupProperty);
  const groups = /* @__PURE__ */ new Map();
  const emptyLabel = groupProperty ? localeStrings.uncategorized : localeStrings.allEntries;
  for (const entry of entries) {
    const rawValue = groupProperty ? resolveEntryPropertyValue(groupProperty, entry) : void 0;
    const label = isEmptyValue(rawValue) ? emptyLabel : formatValue(rawValue);
    const key = label || emptyLabel;
    const existing = groups.get(key);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(key, { label: key, entries: [entry] });
    }
  }
  if (groups.size === 0) {
    groups.set(localeStrings.allEntries, { label: localeStrings.allEntries, entries });
  }
  return /* @__PURE__ */ jsxs("div", { class: "bases-board-wrapper", children: [
    /* @__PURE__ */ jsx("div", { class: "bases-view-meta", children: formatMessage(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ jsx("div", { class: "bases-board", children: Array.from(groups.values()).map((group) => /* @__PURE__ */ jsxs("div", { class: "bases-board-column", children: [
      /* @__PURE__ */ jsxs("div", { class: "bases-board-column-header", children: [
        /* @__PURE__ */ jsx("span", { children: group.label }),
        /* @__PURE__ */ jsx("span", { class: "bases-board-count", children: group.entries.length })
      ] }),
      /* @__PURE__ */ jsx("div", { class: "bases-board-column-body", children: group.entries.map((entry) => {
        const ctx = { slug: entry.slug };
        return /* @__PURE__ */ jsxs("div", { class: "bases-board-card", children: [
          /* @__PURE__ */ jsx("a", { href: `/${entry.slug}`, class: "internal", "data-slug": entry.slug, children: entry.title }),
          columns.length > 0 && /* @__PURE__ */ jsx("div", { class: "bases-board-card-meta", children: columns.map((column) => {
            const value = resolveEntryPropertyValue(column, entry);
            if (isEmptyValue(value)) return null;
            return /* @__PURE__ */ jsxs("div", { class: "bases-board-card-row", children: [
              /* @__PURE__ */ jsx("span", { class: "bases-board-card-label", children: getColumnLabel(column, basesData) }),
              /* @__PURE__ */ jsx("span", { class: "bases-board-card-value", children: renderCellValue(value, ctx) })
            ] });
          }) })
        ] });
      }) })
    ] })) })
  ] });
};
var boardViewRegistration = {
  id: "board",
  name: "Board",
  icon: "columns",
  render: BoardView
};
function formatMessage2(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var CardsView = ({ entries, view, basesData, total, locale }) => {
  const imageProperty = typeof view.image === "string" ? view.image : void 0;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== imageProperty);
  const localeStrings = i18n(locale).components.bases;
  const cardSize = view.cardSize;
  const cardAspect = view.cardAspect;
  const gridStyle = typeof cardSize === "number" && cardSize > 0 ? { gridTemplateColumns: `repeat(auto-fit, minmax(${cardSize}px, 1fr))` } : void 0;
  return /* @__PURE__ */ jsxs("div", { class: "bases-cards-wrapper", children: [
    /* @__PURE__ */ jsx("div", { class: "bases-view-meta", children: formatMessage2(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ jsx("div", { class: "bases-cards", style: gridStyle, children: entries.map((entry) => {
      const ctx = { slug: entry.slug };
      const imageValue = imageProperty ? resolveEntryPropertyValue(imageProperty, entry) : void 0;
      const imageSrc = imageValue ? String(imageValue) : "";
      const imageStyle = typeof cardAspect === "number" && cardAspect > 0 ? { aspectRatio: String(cardAspect) } : void 0;
      return /* @__PURE__ */ jsxs("div", { class: "bases-card", children: [
        imageSrc && /* @__PURE__ */ jsx("div", { class: "bases-card-image", style: imageStyle, children: /* @__PURE__ */ jsx("img", { src: imageSrc, alt: entry.title, loading: "lazy" }) }),
        /* @__PURE__ */ jsxs("div", { class: "bases-card-body", children: [
          /* @__PURE__ */ jsx("a", { href: `/${entry.slug}`, class: "internal", "data-slug": entry.slug, children: entry.title }),
          /* @__PURE__ */ jsx("div", { class: "bases-card-meta", children: columns.map((column) => {
            const value = resolveEntryPropertyValue(column, entry);
            if (isEmptyValue(value)) return null;
            return /* @__PURE__ */ jsxs("div", { class: "bases-card-row", children: [
              /* @__PURE__ */ jsx("span", { class: "bases-card-label", children: getColumnLabel(column, basesData) }),
              /* @__PURE__ */ jsx("span", { class: "bases-card-value", children: renderCellValue(value, ctx) })
            ] });
          }) })
        ] })
      ] });
    }) })
  ] });
};
var cardsViewRegistration = {
  id: "cards",
  name: "Cards",
  icon: "layout-grid",
  render: CardsView
};
function formatMessage3(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var GalleryView = ({ entries, view, total, locale }) => {
  const imageProperty = typeof view.image === "string" ? view.image : void 0;
  const localeStrings = i18n(locale).components.bases;
  const columns = typeof view.cardSize === "number" && view.cardSize > 0 ? Math.round(view.cardSize) : 3;
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };
  return /* @__PURE__ */ jsxs("div", { class: "bases-gallery-wrapper", children: [
    /* @__PURE__ */ jsx("div", { class: "bases-view-meta", children: formatMessage3(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ jsx("div", { class: "bases-gallery", style: gridStyle, children: entries.map((entry) => {
      const imageValue = imageProperty ? resolveEntryPropertyValue(imageProperty, entry) : void 0;
      const imageSrc = imageValue ? String(imageValue) : "";
      return /* @__PURE__ */ jsxs("div", { class: "bases-gallery-item", children: [
        /* @__PURE__ */ jsx("div", { class: "bases-gallery-image", children: imageSrc ? /* @__PURE__ */ jsx("img", { src: imageSrc, alt: entry.title, loading: "lazy" }) : /* @__PURE__ */ jsx(
          "span",
          {
            class: "bases-gallery-placeholder",
            role: "img",
            "aria-label": localeStrings.noImage
          }
        ) }),
        /* @__PURE__ */ jsx("div", { class: "bases-gallery-title", children: /* @__PURE__ */ jsx("a", { href: `/${entry.slug}`, class: "internal", "data-slug": entry.slug, children: entry.title }) })
      ] });
    }) })
  ] });
};
var galleryViewRegistration = {
  id: "gallery",
  name: "Gallery",
  icon: "image",
  render: GalleryView
};
function formatMessage4(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var ListView = ({ entries, view, basesData, total, locale }) => {
  const columns = getColumns(view, basesData, entries);
  const localeStrings = i18n(locale).components.bases;
  return /* @__PURE__ */ jsxs("div", { class: "bases-list-wrapper", children: [
    /* @__PURE__ */ jsx("div", { class: "bases-view-meta", children: formatMessage4(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ jsx("ul", { class: "bases-list", children: entries.map((entry) => {
      const ctx = { slug: entry.slug };
      return /* @__PURE__ */ jsxs("li", { class: "bases-list-item", children: [
        /* @__PURE__ */ jsx("a", { href: `/${entry.slug}`, class: "internal", "data-slug": entry.slug, children: entry.title }),
        columns.length > 1 && /* @__PURE__ */ jsx("div", { class: "bases-list-meta", children: columns.slice(1).map((column) => {
          const value = resolveEntryPropertyValue(column, entry);
          if (isEmptyValue(value)) return null;
          return /* @__PURE__ */ jsxs("span", { class: "bases-list-chip", children: [
            getColumnLabel(column, basesData),
            ": ",
            renderCellValue(value, ctx)
          ] });
        }) })
      ] });
    }) })
  ] });
};
var listViewRegistration = {
  id: "list",
  name: "List",
  icon: "list",
  render: ListView
};

// src/components/shared/summary.tsx
function computeSummary(values, summary) {
  const nonEmpty = values.filter((value) => value !== void 0 && value !== null && value !== "");
  if (summary === "Empty") return String(values.length - nonEmpty.length);
  if (summary === "Filled") return String(nonEmpty.length);
  if (summary === "Checked") return String(values.filter((value) => value === true).length);
  if (summary === "Unchecked") return String(values.filter((value) => value === false).length);
  if (summary === "Unique") return String(new Set(values.map((value) => String(value))).size);
  const numeric = nonEmpty.map((value) => typeof value === "number" ? value : Number(value)).filter((value) => !Number.isNaN(value));
  if (numeric.length === 0) return summary;
  if (summary === "Sum") return String(numeric.reduce((acc, value) => acc + value, 0));
  if (summary === "Average")
    return String(numeric.reduce((acc, value) => acc + value, 0) / numeric.length);
  if (summary === "Min") return String(Math.min(...numeric));
  if (summary === "Max") return String(Math.max(...numeric));
  if (summary === "Range") return String(Math.max(...numeric) - Math.min(...numeric));
  if (summary === "Median") {
    const sorted = [...numeric].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const upper = sorted[mid] ?? 0;
    const lower = sorted[mid - 1] ?? upper;
    const median = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper;
    return String(median);
  }
  if (summary === "Stddev") {
    const mean = numeric.reduce((acc, value) => acc + value, 0) / numeric.length;
    const variance = numeric.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / numeric.length;
    return String(Math.sqrt(variance));
  }
  return summary;
}
function formatMessage5(template, values) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template
  );
}
var TableView = ({ entries, view, basesData, total, locale }) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = Object.keys(summaries).length > 0;
  const localeStrings = i18n(locale).components.bases;
  return /* @__PURE__ */ jsxs("div", { class: "bases-table-wrapper", children: [
    /* @__PURE__ */ jsx("div", { class: "bases-view-meta", children: formatMessage5(localeStrings.showingCount, {
      count: entries.length,
      total
    }) }),
    /* @__PURE__ */ jsxs("table", { class: "bases-table", "data-view-type": "table", children: [
      /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", { children: columns.map((column) => {
        const columnWidth = view.columnSize?.[column];
        const style = columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` } : void 0;
        return /* @__PURE__ */ jsxs("th", { "data-column": column, "data-sortable": "true", style, children: [
          getColumnLabel(column, basesData),
          /* @__PURE__ */ jsx("span", { class: "bases-sort-indicator", "aria-hidden": "true" })
        ] });
      }) }) }),
      /* @__PURE__ */ jsx("tbody", { children: entries.map((entry) => {
        const ctx = { slug: entry.slug };
        return /* @__PURE__ */ jsx("tr", { children: columns.map((column) => {
          const value = resolveEntryPropertyValue(column, entry);
          const display = formatValue(value);
          const isPrimary = column === "file.name" || column === "title";
          const columnWidth = view.columnSize?.[column];
          const style = columnWidth ? { width: `${columnWidth}px`, minWidth: `${columnWidth}px` } : void 0;
          return /* @__PURE__ */ jsx("td", { "data-value": display, style, children: isPrimary ? /* @__PURE__ */ jsx("a", { href: `/${entry.slug}`, class: "internal", "data-slug": entry.slug, children: display || entry.title }) : renderCellValue(value, ctx) });
        }) });
      }) }),
      hasSummary && /* @__PURE__ */ jsx("tfoot", { children: /* @__PURE__ */ jsx("tr", { class: "bases-summary-row", children: columns.map((column) => {
        const summary = summaries[column];
        if (!summary) return /* @__PURE__ */ jsx("td", {});
        const values = entries.map((entry) => resolveEntryPropertyValue(column, entry));
        return /* @__PURE__ */ jsx("td", { children: computeSummary(values, summary) });
      }) }) })
    ] })
  ] });
};
var tableViewRegistration = {
  id: "table",
  name: "Table",
  icon: "table",
  render: TableView
};

// src/components/views/index.ts
function registerBuiltinViews() {
  viewRegistry.register(tableViewRegistration);
  viewRegistry.register(listViewRegistration);
  viewRegistry.register(cardsViewRegistration);
  viewRegistry.register(galleryViewRegistration);
  viewRegistry.register(boardViewRegistration);
}

// src/components/styles/bases.scss
var bases_default = ".bases-page {\n  width: 100%;\n  max-width: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n  overflow: hidden;\n}\n\n.bases-view-tabs {\n  display: flex;\n  gap: 8px;\n  flex-wrap: wrap;\n}\n.bases-view-tabs button {\n  border: 1px solid var(--lightgray);\n  background: var(--light);\n  color: var(--darkgray);\n  padding: 6px 12px;\n  border-radius: 999px;\n  cursor: pointer;\n  font-size: 0.9rem;\n}\n.bases-view-tabs button.is-active {\n  background: var(--secondary);\n  color: var(--light);\n  border-color: var(--secondary);\n}\n\n.bases-view-container {\n  display: flex;\n  flex-direction: column;\n  gap: 16px;\n}\n\n.bases-view {\n  display: none;\n}\n.bases-view.is-active {\n  display: block;\n}\n\n.bases-view-meta {\n  font-size: 0.85rem;\n  color: var(--gray);\n  margin-bottom: 8px;\n}\n\n.bases-table-wrapper {\n  width: 100%;\n  overflow-x: auto;\n}\n\n.bases-table {\n  width: 100%;\n  border-collapse: collapse;\n  border: 1px solid var(--lightgray);\n  border-radius: 8px;\n  overflow: hidden;\n}\n.bases-table th,\n.bases-table td {\n  padding: 10px 12px;\n  text-align: left;\n  border-bottom: 1px solid var(--lightgray);\n  font-size: 0.9rem;\n}\n.bases-table thead th {\n  position: sticky;\n  top: 0;\n  background: var(--light);\n  color: var(--dark);\n  font-weight: 600;\n  cursor: pointer;\n}\n.bases-table tbody tr:nth-child(even) {\n  background: var(--lightgray);\n}\n.bases-table td .bases-empty {\n  padding: 0;\n  border: 0;\n  background: none;\n  color: var(--gray);\n  display: inline;\n}\n.bases-table td code {\n  font-size: 0.85em;\n  padding: 0.1rem 0.3rem;\n  border-radius: 3px;\n  background: var(--highlight);\n  word-break: break-all;\n}\n\n.bases-sort-indicator {\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  margin-left: 6px;\n  border-right: 2px solid transparent;\n  border-bottom: 2px solid transparent;\n}\n\nth.is-sorted-asc .bases-sort-indicator {\n  border-right-color: var(--darkgray);\n  border-bottom-color: var(--darkgray);\n  transform: rotate(-45deg);\n}\n\nth.is-sorted-desc .bases-sort-indicator {\n  border-right-color: var(--darkgray);\n  border-bottom-color: var(--darkgray);\n  transform: rotate(135deg);\n}\n\n.bases-summary-row td {\n  background: var(--light);\n  font-weight: 600;\n  color: var(--darkgray);\n}\n\n.bases-separator {\n  color: var(--gray);\n}\n\n.bases-number {\n  font-variant-numeric: tabular-nums;\n}\n\n.bases-list {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 12px;\n}\n\n.bases-list-item {\n  padding: 12px;\n  border: 1px solid var(--lightgray);\n  border-radius: 8px;\n  background: var(--light);\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bases-list-meta {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 6px;\n}\n\n.bases-list-chip {\n  background: var(--lightgray);\n  color: var(--darkgray);\n  padding: 2px 8px;\n  border-radius: 999px;\n  font-size: 0.75rem;\n}\n\n.bases-cards {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));\n  gap: 16px;\n}\n\n.bases-card {\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  overflow: hidden;\n  background: var(--light);\n  display: flex;\n  flex-direction: column;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);\n}\n\n.bases-card-image img {\n  width: 100%;\n  height: 140px;\n  object-fit: cover;\n}\n\n.bases-card-body {\n  padding: 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bases-card-meta {\n  display: grid;\n  gap: 4px;\n}\n\n.bases-card-row {\n  display: flex;\n  justify-content: space-between;\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n\n.bases-card-label {\n  color: var(--gray);\n}\n\n.bases-map-placeholder {\n  padding: 24px;\n  border: 1px dashed var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n}\n\n.bases-map-message {\n  color: var(--darkgray);\n  margin-top: 12px;\n}\n\n.bases-empty {\n  padding: 24px;\n  text-align: center;\n  color: var(--darkgray);\n  border: 1px dashed var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n}\n\n.bases-gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr));\n  gap: 16px;\n}\n\n.bases-gallery-item {\n  position: relative;\n  border-radius: 12px;\n  overflow: hidden;\n  border: 1px solid var(--lightgray);\n  background: var(--light);\n}\n\n.bases-gallery-image {\n  aspect-ratio: 4/3;\n  overflow: hidden;\n  background: var(--lightgray);\n}\n\n.bases-gallery-image img,\n.bases-gallery-placeholder {\n  width: 100%;\n  height: 100%;\n  display: block;\n  object-fit: cover;\n}\n\n.bases-gallery-placeholder {\n  background: linear-gradient(135deg, var(--lightgray), var(--highlight));\n}\n\n.bases-gallery-title {\n  position: absolute;\n  left: 0;\n  right: 0;\n  bottom: 0;\n  padding: 10px 12px;\n  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.65) 100%);\n  color: var(--light);\n  font-weight: 600;\n}\n\n.bases-gallery-title a {\n  color: inherit;\n}\n\n.bases-board {\n  display: flex;\n  gap: 16px;\n  overflow-x: auto;\n  padding-bottom: 4px;\n}\n\n.bases-board-column {\n  min-width: min(250px, 80vw);\n  flex-shrink: 0;\n  border: 1px solid var(--lightgray);\n  border-radius: 12px;\n  background: var(--light);\n  display: flex;\n  flex-direction: column;\n}\n\n.bases-board-column-header {\n  position: sticky;\n  top: 0;\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 8px;\n  padding: 10px 12px;\n  font-weight: 600;\n  background: var(--light);\n  border-bottom: 1px solid var(--lightgray);\n  z-index: 1;\n}\n\n.bases-board-count {\n  background: var(--lightgray);\n  color: var(--darkgray);\n  border-radius: 999px;\n  padding: 2px 8px;\n  font-size: 0.75rem;\n}\n\n.bases-board-column-body {\n  padding: 8px;\n  display: flex;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.bases-board-card {\n  border: 1px solid var(--lightgray);\n  border-radius: 10px;\n  background: var(--light);\n  padding: 10px 12px;\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.08);\n}\n\n.bases-board-card-meta {\n  display: grid;\n  gap: 4px;\n  font-size: 0.8rem;\n  color: var(--darkgray);\n}\n\n.bases-board-card-row {\n  display: flex;\n  justify-content: space-between;\n  gap: 8px;\n}\n\n.bases-board-card-label {\n  color: var(--gray);\n}";

// src/components/scripts/bases.inline.ts
var bases_inline_default = `function v(e,t){let n=e.querySelectorAll(".bases-view-tabs button"),r=e.querySelectorAll(".bases-view");n.forEach(s=>{s.classList.toggle("is-active",s.dataset.viewIndex===String(t))}),r.forEach(s=>{s.classList.toggle("is-active",s.dataset.viewIndex===String(t))})}function f(e,t){let n=Number(e),r=Number(t);return!Number.isNaN(n)&&!Number.isNaN(r)?n-r:String(e).localeCompare(String(t))}function b(e,t,n){let r=e.querySelector("tbody");if(!r)return;let s=Array.from(r.querySelectorAll("tr"));s.sort((c,o)=>{let a=c.children[t],u=o.children[t],i=a?.dataset?.value??a?.textContent??"",l=u?.dataset?.value??u?.textContent??"";return f(i,l)}),n==="desc"&&s.reverse(),s.forEach(c=>{r.appendChild(c)})}function m(e,t){e.querySelectorAll(".bases-table").forEach(r=>{let s=r.querySelectorAll("th[data-sortable='true']");s.forEach((c,o)=>{let a=()=>{let i=(c.dataset.sortDirection||"none")==="asc"?"desc":"asc";s.forEach(l=>{l!==c&&(l.dataset.sortDirection="none"),l.classList.remove("is-sorted-asc","is-sorted-desc")}),c.dataset.sortDirection=i,c.classList.toggle("is-sorted-asc",i==="asc"),c.classList.toggle("is-sorted-desc",i==="desc"),b(r,o,i)};c.addEventListener("click",a),t.push(()=>c.removeEventListener("click",a))})})}function E(e,t){let n=e.querySelectorAll(".bases-view-tabs button");if(n.length===0)return;let r=parseInt(e.dataset.initialView||"0",10);v(e,Number.isNaN(r)?0:r),n.forEach(s=>{let c=()=>{let o=parseInt(s.dataset.viewIndex||"0",10);v(e,Number.isNaN(o)?0:o)};s.addEventListener("click",c),t.push(()=>s.removeEventListener("click",c))})}function d(){let e=document.querySelectorAll(".bases-page");if(e.length===0)return;let t=[];e.forEach(n=>{E(n,t),m(n,t)}),window.addCleanup&&window.addCleanup(()=>{t.forEach(n=>{n()})})}document.addEventListener("nav",()=>{d()});document.addEventListener("render",()=>{d()});d();
`;
var builtinViewsRegistered = false;
var BasesBody_default = ((opts) => {
  const Component = (props) => {
    const locale = props.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const fileData = props.fileData;
    const basesData = fileData.basesData;
    const basesOptions = fileData.basesOptions ?? opts;
    const slug = props.fileData.slug ?? "";
    const allSlugs = props.ctx?.allSlugs ?? [];
    const linkResolution = basesOptions?.linkResolution ?? "shortest";
    if (!basesData) {
      return /* @__PURE__ */ jsx("div", { class: "bases-page bases-empty", children: localeStrings.noData });
    }
    const views = basesData.views ?? [];
    if (views.length === 0) {
      return /* @__PURE__ */ jsx("div", { class: "bases-page bases-empty", children: localeStrings.noViews });
    }
    const preferredType = basesOptions?.defaultViewType ?? "table";
    const initialIndex = Math.max(
      0,
      views.findIndex((view) => view.type === preferredType)
    );
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }
    if (basesOptions?.customViews) {
      registerCustomViews(basesOptions.customViews);
    }
    const activeTypes = new Set(views.map((v) => v.type));
    const viewCssChunks = [];
    for (const typeId of activeTypes) {
      const reg = viewRegistry.get(typeId);
      if (reg?.css) viewCssChunks.push(reg.css);
    }
    return /* @__PURE__ */ jsxs("div", { class: "bases-page", "data-initial-view": initialIndex, children: [
      viewCssChunks.length > 0 && /* @__PURE__ */ jsx("style", { dangerouslySetInnerHTML: { __html: viewCssChunks.join("\n") } }),
      /* @__PURE__ */ jsx(ViewSelector, { views, activeIndex: initialIndex, locale }),
      /* @__PURE__ */ jsx("div", { class: "bases-view-container", children: views.map((view, index) => {
        const { entries, total } = resolveBasesEntries(basesData, props.allFiles, view);
        const registration = viewRegistry.get(view.type);
        const Renderer = registration?.render;
        return /* @__PURE__ */ jsx(
          "div",
          {
            class: `bases-view ${index === initialIndex ? "is-active" : ""}`,
            "data-view-index": index,
            "data-view-type": view.type,
            children: entries.length === 0 ? /* @__PURE__ */ jsx("div", { class: "bases-empty", children: localeStrings.noData }) : Renderer ? /* @__PURE__ */ jsx(
              Renderer,
              {
                entries,
                view,
                basesData,
                total,
                locale,
                slug,
                allSlugs,
                linkResolution
              }
            ) : /* @__PURE__ */ jsxs("div", { class: "bases-empty", children: [
              "Unknown view type: ",
              view.type
            ] })
          }
        );
      }) })
    ] });
  };
  Component.css = bases_default;
  const viewScripts = viewRegistry.getAll().map((reg) => reg.afterDOMLoaded).filter((s) => typeof s === "string" && s.length > 0);
  Component.afterDOMLoaded = [bases_inline_default, ...viewScripts];
  return Component;
});

export { BasesBody_default, ViewSelector, i18n, registerBuiltinViews, resolveBasesEntries };
//# sourceMappingURL=chunk-HHQ2K6HH.js.map
//# sourceMappingURL=chunk-HHQ2K6HH.js.map