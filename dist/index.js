import { BasesBody_default, resolveBasesEntries, registerBuiltinViews, i18n, ViewSelector } from './chunk-HHQ2K6HH.js';
export { BasesBody_default as BasesBody } from './chunk-HHQ2K6HH.js';
import { registerCustomViews, viewRegistry } from './chunk-LHVPD2IS.js';
export { registerCustomViews, viewRegistry } from './chunk-LHVPD2IS.js';
export { compile, evaluate, evaluateFilter, resolvePropertyValue } from './chunk-RBP2NPYV.js';
import { visit } from 'unist-util-visit';
import { render } from 'preact-render-to-string';
import { h, Fragment } from 'preact';
import { fromHtml } from 'hast-util-from-html';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';
export { transformLink } from '@quartz-community/utils';

function extractBaseBlock(raw) {
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
function normalizeViews(views) {
  if (views === void 0) return void 0;
  if (!Array.isArray(views)) return null;
  const normalized = views.map((view) => {
    if (!view || typeof view !== "object" || Array.isArray(view)) return null;
    const record = view;
    if (typeof record.type !== "string") return null;
    return record;
  }).filter((view) => view !== null);
  return normalized;
}
function parseBasesData(raw) {
  const block = extractBaseBlock(raw);
  const content = block ?? raw;
  let data;
  try {
    data = parse(content);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }
  const record = data;
  const views = normalizeViews(record.views);
  if (views === null) return null;
  return {
    ...record,
    views
  };
}

// src/pageType.ts
var basesMatcher = ({ fileData }) => {
  return "basesData" in fileData;
};
var BasesPage = (opts) => ({
  name: "BasesPage",
  priority: 20,
  fileExtensions: [".base"],
  match: basesMatcher,
  generate({ content, ctx }) {
    const baseFiles = ctx.allFiles.filter((fp) => fp.endsWith(".base"));
    const allFileData = content.map((c) => c[1].data);
    const virtualPages = [];
    for (const filePath of baseFiles) {
      const fullPath = join(ctx.argv.directory, filePath);
      let raw;
      try {
        raw = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }
      const basesData = parseBasesData(raw);
      if (!basesData) continue;
      const slug = filePath.replace(/\.base$/, "");
      const baseName = slug.split("/").pop() ?? "Base";
      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          links: resolveBasesEntries(basesData, allFileData).entries.map((e) => e.slug),
          basesData,
          basesOptions: opts
        }
      });
    }
    return virtualPages;
  },
  layout: "bases",
  body: BasesBody_default,
  treeTransforms(_ctx) {
    return [createBasesCodeblockTransform(opts)];
  }
});
function createBasesCodeblockTransform(opts) {
  let builtinViewsRegistered = false;
  return (root, _slug, componentData) => {
    const fileData = componentData.fileData;
    const basesBlocks = fileData.basesBlocks;
    if (!basesBlocks || basesBlocks.length === 0) return;
    if (!builtinViewsRegistered) {
      registerBuiltinViews();
      builtinViewsRegistered = true;
    }
    if (opts?.customViews) {
      registerCustomViews(opts.customViews);
    }
    const locale = componentData.cfg?.locale ?? "en-US";
    const localeStrings = i18n(locale).components.bases;
    const allFiles = componentData.allFiles;
    const slug = componentData.fileData.slug ?? "";
    const allSlugs = componentData.ctx?.allSlugs ?? [];
    const linkResolution = opts?.linkResolution ?? "shortest";
    visit(root, "element", (node, index, parent) => {
      if (!parent || index === void 0) return;
      const blockIndexStr = node.properties?.["dataQzBasesCodeblock"];
      if (blockIndexStr === void 0) return;
      const blockIndex = Number(blockIndexStr);
      const basesData = basesBlocks[blockIndex];
      if (!basesData) return;
      const htmlString = renderBasesInline(
        basesData,
        allFiles,
        locale,
        localeStrings,
        opts,
        slug,
        allSlugs,
        linkResolution
      );
      const fragment = fromHtml(htmlString, { fragment: true });
      node.tagName = "div";
      node.properties = { class: "bases-page bases-inline" };
      node.children = fragment.children;
    });
  };
}
function renderBasesInline(basesData, allFiles, locale, localeStrings, opts, slug, allSlugs, linkResolution) {
  const views = basesData.views ?? [];
  if (views.length === 0) {
    return `<div class="bases-empty">${localeStrings.noViews}</div>`;
  }
  const preferredType = opts?.defaultViewType ?? "table";
  const initialIndex = Math.max(
    0,
    views.findIndex((view) => view.type === preferredType)
  );
  const activeTypes = new Set(views.map((v) => v.type));
  const viewCssChunks = [];
  for (const typeId of activeTypes) {
    const reg = viewRegistry.get(typeId);
    if (reg?.css) viewCssChunks.push(reg.css);
  }
  const selectorHtml = render(
    h(Fragment, null, ViewSelector({ views, activeIndex: initialIndex, locale }))
  );
  const viewPanels = views.map((view, index) => {
    const { entries, total } = resolveBasesEntries(basesData, allFiles, view);
    const registration = viewRegistry.get(view.type);
    const Renderer = registration?.render;
    const activeClass = index === initialIndex ? " is-active" : "";
    let innerHtml;
    if (entries.length === 0) {
      innerHtml = `<div class="bases-empty">${localeStrings.noData}</div>`;
    } else if (Renderer) {
      innerHtml = render(
        h(
          Fragment,
          null,
          Renderer({ entries, view, basesData, total, locale, slug, allSlugs, linkResolution })
        )
      );
    } else {
      innerHtml = `<div class="bases-empty">Unknown view type: ${view.type}</div>`;
    }
    return `<div class="bases-view${activeClass}" data-view-index="${index}" data-view-type="${view.type}">${innerHtml}</div>`;
  });
  const cssBlock = viewCssChunks.length > 0 ? `<style>${viewCssChunks.join("\n")}</style>` : "";
  return `${cssBlock}${selectorHtml}<div class="bases-view-container">${viewPanels.join("")}</div>`;
}
var BasesTransformer = (_opts) => {
  return {
    name: "BasesTransformer",
    htmlPlugins() {
      return [
        () => {
          return (tree, file) => {
            const basesBlocks = [];
            visit(tree, "element", (node, index, parent) => {
              if (!parent || index === void 0) return;
              const {
                codeElement,
                replaceNode: _replaceNode,
                replaceIndex,
                replaceParent
              } = findBaseCodeblock(node, index, parent);
              if (!codeElement) return;
              const rawText = extractText(codeElement);
              if (!rawText) return;
              const basesData = parseBasesData(rawText);
              if (!basesData) return;
              const blockIndex = basesBlocks.length;
              basesBlocks.push(basesData);
              const placeholder = {
                type: "element",
                tagName: "div",
                properties: {
                  dataQzBasesCodeblock: String(blockIndex)
                },
                children: []
              };
              replaceParent.children[replaceIndex] = placeholder;
            });
            if (basesBlocks.length > 0) {
              file.data.basesBlocks = basesBlocks;
            }
          };
        }
      ];
    }
  };
};
function findBaseCodeblock(node, index, parent) {
  const empty = {
    codeElement: null,
    replaceNode: node,
    replaceIndex: index ?? 0,
    replaceParent: parent
  };
  if (node.tagName === "pre") {
    const code = findCodeChild(node);
    if (code && isBaseLanguage(code)) {
      return {
        codeElement: code,
        replaceNode: node,
        replaceIndex: index ?? 0,
        replaceParent: parent
      };
    }
    return empty;
  }
  if (node.tagName === "figure" && node.properties?.dataRehypePrettyCodeFigure !== void 0) {
    const pre = node.children.find(
      (child) => child.type === "element" && child.tagName === "pre"
    );
    if (pre) {
      const code = findCodeChild(pre);
      if (code && isBaseLanguage(code)) {
        return {
          codeElement: code,
          replaceNode: node,
          replaceIndex: index ?? 0,
          replaceParent: parent
        };
      }
    }
    return empty;
  }
  return empty;
}
function findCodeChild(pre) {
  return pre.children.find(
    (child) => child.type === "element" && child.tagName === "code"
  ) ?? null;
}
function isBaseLanguage(code) {
  const classNames = code.properties?.className ?? [];
  if (classNames.includes("language-base")) return true;
  if (code.properties?.dataLanguage === "base") return true;
  return false;
}
function extractText(node) {
  const parts = [];
  for (const child of node.children) {
    if (child.type === "text") {
      parts.push(child.value);
    } else if (child.type === "element") {
      parts.push(extractText(child));
    }
  }
  return parts.join("");
}

export { BasesPage, BasesTransformer };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map