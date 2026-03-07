import type { Root as HTMLRoot, Element } from "hast";
import type { QuartzTransformerPlugin } from "@quartz-community/types";
import type { VFile } from "vfile";
import { visit } from "unist-util-visit";
import { parseBasesData } from "./parser";
import type { BasesData, BasesPageOptions } from "./types";

/**
 * Rehype plugin that finds ` ```base ` codeblocks in the HAST tree and replaces
 * them with placeholder `<div>` elements. The parsed BasesData for each block is
 * stored on `vfile.data.basesBlocks` so it can be resolved at render time by the
 * tree-transform hook (when `allFiles` is available).
 *
 * Markdown parsers convert fenced code blocks to `<pre><code class="language-base">`.
 * This plugin detects that pattern, extracts the text content, parses it as YAML
 * via `parseBasesData()`, and replaces the `<pre>` node with a placeholder div.
 */
export const BasesTransformer: QuartzTransformerPlugin<Partial<BasesPageOptions>> = (_opts) => {
  return {
    name: "BasesTransformer",
    htmlPlugins() {
      return [
        () => {
          return (tree: HTMLRoot, file: VFile) => {
            const basesBlocks: BasesData[] = [];

            visit(tree, "element", (node: Element, index, parent) => {
              if (node.tagName !== "pre" || !parent || index === undefined) return;

              // Look for <pre><code class="language-base">
              const codeChild = node.children.find(
                (child): child is Element => child.type === "element" && child.tagName === "code",
              );
              if (!codeChild) return;

              const classNames = (codeChild.properties?.className ?? []) as string[];
              if (!classNames.includes("language-base")) return;

              // Extract raw text from the <code> element
              const rawText = extractText(codeChild);
              if (!rawText) return;

              // Parse as YAML — parseBasesData handles both raw YAML and ``` fenced blocks
              const basesData = parseBasesData(rawText);
              if (!basesData) return;

              const blockIndex = basesBlocks.length;
              basesBlocks.push(basesData);

              // Replace the <pre> node with a placeholder div
              const placeholder: Element = {
                type: "element",
                tagName: "div",
                properties: {
                  dataQzBasesCodeblock: String(blockIndex),
                },
                children: [],
              };

              parent.children[index] = placeholder;
            });

            if (basesBlocks.length > 0) {
              file.data.basesBlocks = basesBlocks;
            }
          };
        },
      ];
    },
  };
};

/**
 * Recursively extract text content from a HAST element.
 * Avoids regex by walking the tree structure directly.
 */
function extractText(node: Element): string {
  const parts: string[] = [];
  for (const child of node.children) {
    if (child.type === "text") {
      parts.push(child.value);
    } else if (child.type === "element") {
      parts.push(extractText(child));
    }
  }
  return parts.join("");
}

declare module "vfile" {
  interface DataMap {
    basesBlocks?: BasesData[];
  }
}
