// Re-export needed types from @quartz-community/types
export type {
  BuildCtx,
  FullSlug,
  FilePath,
  ProcessedContent,
  QuartzPluginData,
  PageMatcher,
  PageGenerator,
  VirtualPage,
  QuartzPageTypePlugin,
  QuartzPageTypePluginInstance,
  QuartzComponent,
  QuartzComponentProps,
  QuartzComponentConstructor,
  GlobalConfiguration,
} from "@quartz-community/types";

// === Bases Types ===

/** Plugin options */
export interface BasesPageOptions {
  /** Default view type when none specified. Default: "table" */
  defaultViewType?: string;
}

/** Sort direction */
export type SortDirection = "ASC" | "DESC";

/** Filter tree node — recursive and/or/not structure */
export type FilterNode =
  | string
  | { and: FilterNode[] }
  | { or: FilterNode[] }
  | { not: FilterNode[] };

/** Group-by configuration */
export interface GroupBy {
  property: string;
  direction?: SortDirection;
}

/** Summary configuration per property */
export type SummaryType =
  | "Average"
  | "Min"
  | "Max"
  | "Sum"
  | "Range"
  | "Median"
  | "Stddev"
  | "Earliest"
  | "Latest"
  | "Checked"
  | "Unchecked"
  | "Empty"
  | "Filled"
  | "Unique"
  | string;

/** Property display configuration */
export interface PropertyConfig {
  displayName?: string;
}

/** View definition */
export interface BasesView {
  type: string;
  name?: string;
  limit?: number;
  groupBy?: GroupBy;
  filters?: FilterNode;
  order?: string[];
  summaries?: Record<string, SummaryType>;
  [key: string]: unknown;
}

/** Top-level .base file structure */
export interface BasesData {
  filters?: FilterNode;
  formulas?: Record<string, string>;
  properties?: Record<string, PropertyConfig>;
  summaries?: Record<string, string>;
  views?: BasesView[];
}

/** Resolved entry — a note that matches the base query */
export interface BasesEntry {
  slug: string;
  title: string;
  /** All frontmatter properties */
  properties: Record<string, unknown>;
  /** File metadata properties */
  fileProperties: {
    name: string;
    path: string;
    folder: string;
    ext: string;
    tags: string[];
    links: string[];
  };
  /** Computed formula values */
  formulaValues: Record<string, unknown>;
}
