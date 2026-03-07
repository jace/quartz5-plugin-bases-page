import type {
  QuartzPageTypePlugin,
  PageMatcher,
  FullSlug,
  VirtualPage,
} from "@quartz-community/types";
import { readFileSync } from "fs";
import { join } from "path";
import { parseBasesData } from "./parser";
import { resolveBasesEntries } from "./resolver";
import BasesBody from "./components/BasesBody";
import type { BasesPageOptions } from "./types";

const basesMatcher: PageMatcher = ({ fileData }) => {
  return "basesData" in fileData;
};

export const BasesPage: QuartzPageTypePlugin<BasesPageOptions> = (opts) => ({
  name: "BasesPage",
  priority: 20,
  fileExtensions: [".base"],
  match: basesMatcher,
  generate({ content, ctx }) {
    const baseFiles = ctx.allFiles.filter((fp) => fp.endsWith(".base"));
    const allFileData = content.map((c) => c[1].data);
    const virtualPages: VirtualPage[] = [];

    for (const filePath of baseFiles) {
      const fullPath = join(ctx.argv.directory, filePath);
      let raw: string;
      try {
        raw = readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      const basesData = parseBasesData(raw);
      if (!basesData) continue;

      const slug = filePath.replace(/\.base$/, "") as unknown as FullSlug;
      const baseName = slug.split("/").pop() ?? "Base";

      virtualPages.push({
        slug,
        title: baseName,
        data: {
          frontmatter: { title: baseName, tags: [] },
          links: resolveBasesEntries(basesData, allFileData).entries.map((e) => e.slug),
          basesData,
          basesOptions: opts,
        },
      });
    }

    return virtualPages;
  },
  layout: "bases",
  body: BasesBody,
});
