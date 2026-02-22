import type { ComponentChild } from "preact";
import type {
  QuartzComponent,
  QuartzComponentConstructor,
  QuartzComponentProps,
} from "@quartz-community/types";
import type { BasesData, BasesEntry, BasesPageOptions, BasesView, SummaryType } from "../types";
import { resolveBasesEntries } from "../resolver";
import { resolvePropertyValue } from "../evaluator";
import { i18n } from "../i18n";
import style from "./styles/bases.scss";
// @ts-ignore
import script from "./scripts/bases.inline.ts";

type ViewRenderer = (props: {
  entries: BasesEntry[];
  view: BasesView;
  basesData: BasesData;
  total: number;
  locale: string;
}) => ComponentChild;

function formatMessage(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getColumnLabel(column: string, basesData: BasesData): string {
  const config = basesData.properties?.[column];
  if (config?.displayName) return config.displayName;
  const segment = column.split(".").pop() ?? column;
  return segment
    .split("_")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function getColumns(view: BasesView, basesData: BasesData, entries: BasesEntry[]): string[] {
  if (view.order && view.order.length > 0) return view.order;
  const columns = new Set<string>();
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

function computeSummary(values: unknown[], summary: SummaryType): string {
  const nonEmpty = values.filter((value) => value !== undefined && value !== null && value !== "");
  if (summary === "Empty") return String(values.length - nonEmpty.length);
  if (summary === "Filled") return String(nonEmpty.length);
  if (summary === "Checked") return String(values.filter((value) => value === true).length);
  if (summary === "Unchecked") return String(values.filter((value) => value === false).length);
  if (summary === "Unique") return String(new Set(values.map((value) => String(value))).size);

  const numeric = nonEmpty
    .map((value) => (typeof value === "number" ? value : Number(value)))
    .filter((value) => !Number.isNaN(value));

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
    const variance =
      numeric.reduce((acc, value) => acc + Math.pow(value - mean, 2), 0) / numeric.length;
    return String(Math.sqrt(variance));
  }

  return summary;
}

const TableView: ViewRenderer = ({ entries, view, basesData, total, locale }) => {
  const columns = getColumns(view, basesData, entries);
  const summaries = view.summaries ?? {};
  const hasSummary = Object.keys(summaries).length > 0;
  const localeStrings = i18n(locale).components.bases;

  return (
    <div class="bases-table-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <table class="bases-table" data-view-type="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th data-column={column} data-sortable="true">
                {getColumnLabel(column, basesData)}
                <span class="bases-sort-indicator" aria-hidden="true" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr>
              {columns.map((column) => {
                const value = resolvePropertyValue(column, {
                  note: entry.properties,
                  file: entry.fileProperties,
                  formula: entry.formulaValues,
                });
                const display = formatValue(value);
                const isPrimary = column === "file.name" || column === "title";
                return (
                  <td data-value={display}>
                    {isPrimary ? (
                      <a href={`/${entry.slug}`} class="internal" data-slug={entry.slug}>
                        {display || entry.title}
                      </a>
                    ) : (
                      display
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {hasSummary && (
          <tfoot>
            <tr class="bases-summary-row">
              {columns.map((column) => {
                const summary = summaries[column];
                if (!summary) return <td />;
                const values = entries.map((entry) =>
                  resolvePropertyValue(column, {
                    note: entry.properties,
                    file: entry.fileProperties,
                    formula: entry.formulaValues,
                  }),
                );
                return <td>{computeSummary(values, summary)}</td>;
              })}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
};

const ListView: ViewRenderer = ({ entries, view, basesData, total, locale }) => {
  const columns = getColumns(view, basesData, entries);
  const localeStrings = i18n(locale).components.bases;

  return (
    <div class="bases-list-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <ul class="bases-list">
        {entries.map((entry) => (
          <li class="bases-list-item">
            <a href={`/${entry.slug}`} class="internal" data-slug={entry.slug}>
              {entry.title}
            </a>
            {columns.length > 1 && (
              <div class="bases-list-meta">
                {columns.slice(1).map((column) => {
                  const value = resolvePropertyValue(column, {
                    note: entry.properties,
                    file: entry.fileProperties,
                    formula: entry.formulaValues,
                  });
                  const display = formatValue(value);
                  return display ? (
                    <span class="bases-list-chip">
                      {getColumnLabel(column, basesData)}: {display}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

const CardsView: ViewRenderer = ({ entries, view, basesData, total, locale }) => {
  const imageProperty = typeof view.imageProperty === "string" ? view.imageProperty : undefined;
  const columns = getColumns(view, basesData, entries).filter((column) => column !== imageProperty);
  const localeStrings = i18n(locale).components.bases;

  return (
    <div class="bases-cards-wrapper">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <div class="bases-cards">
        {entries.map((entry) => {
          const imageValue = imageProperty
            ? resolvePropertyValue(imageProperty, {
                note: entry.properties,
                file: entry.fileProperties,
                formula: entry.formulaValues,
              })
            : undefined;
          const imageSrc = imageValue ? String(imageValue) : "";
          return (
            <div class="bases-card">
              {imageSrc && (
                <div class="bases-card-image">
                  <img src={imageSrc} alt={entry.title} loading="lazy" />
                </div>
              )}
              <div class="bases-card-body">
                <a href={`/${entry.slug}`} class="internal" data-slug={entry.slug}>
                  {entry.title}
                </a>
                <div class="bases-card-meta">
                  {columns.map((column) => {
                    const value = resolvePropertyValue(column, {
                      note: entry.properties,
                      file: entry.fileProperties,
                      formula: entry.formulaValues,
                    });
                    const display = formatValue(value);
                    return display ? (
                      <div class="bases-card-row">
                        <span class="bases-card-label">{getColumnLabel(column, basesData)}</span>
                        <span class="bases-card-value">{display}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MapView: ViewRenderer = ({ entries, view: _view, basesData: _basesData, total, locale }) => {
  const localeStrings = i18n(locale).components.bases;
  return (
    <div class="bases-map-placeholder">
      <div class="bases-view-meta">
        {formatMessage(localeStrings.showingCount, {
          count: entries.length,
          total,
        })}
      </div>
      <div class="bases-map-message">{localeStrings.mapPlaceholder}</div>
    </div>
  );
};

const viewRenderers: Record<string, ViewRenderer> = {
  table: TableView,
  list: ListView,
  cards: CardsView,
  map: MapView,
};

export default ((opts?: BasesPageOptions) => {
  const Component: QuartzComponent = (props: QuartzComponentProps) => {
    const locale = props.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const fileData = props.fileData as { basesData?: BasesData; basesOptions?: BasesPageOptions };
    const basesData = fileData.basesData;
    const basesOptions = fileData.basesOptions ?? opts;

    if (!basesData) {
      return <div class="bases-page bases-empty">{localeStrings.noData}</div>;
    }

    const views = basesData.views ?? [];
    if (views.length === 0) {
      return <div class="bases-page bases-empty">{localeStrings.noViews}</div>;
    }

    const preferredType = basesOptions?.defaultViewType ?? "table";
    const initialIndex = Math.max(
      0,
      views.findIndex((view) => view.type === preferredType),
    );

    return (
      <div class="bases-page" data-initial-view={initialIndex}>
        {views.length > 1 && (
          <div class="bases-view-tabs" role="tablist">
            {views.map((view, index) => (
              <button
                type="button"
                class={index === initialIndex ? "is-active" : ""}
                data-view-index={index}
              >
                {view.name ?? view.type ?? localeStrings.allNotes}
              </button>
            ))}
          </div>
        )}
        <div class="bases-view-container">
          {views.map((view, index) => {
            const { entries, total } = resolveBasesEntries(basesData, props.allFiles, view);
            const Renderer = viewRenderers[view.type];
            return (
              <div
                class={`bases-view ${index === initialIndex ? "is-active" : ""}`}
                data-view-index={index}
                data-view-type={view.type}
              >
                {entries.length === 0 ? (
                  <div class="bases-empty">{localeStrings.noData}</div>
                ) : Renderer ? (
                  <Renderer
                    entries={entries}
                    view={view}
                    basesData={basesData}
                    total={total}
                    locale={locale}
                  />
                ) : (
                  <div class="bases-empty">Unknown view type: {view.type}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  Component.css = style;
  Component.afterDOMLoaded = script;

  return Component;
}) satisfies QuartzComponentConstructor<BasesPageOptions>;
