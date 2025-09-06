import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

type Edge = { from: string; to: string };

const CWD = process.cwd();
const INCLUDE_EXTERNAL = false;
const INCLUDE_D_TS = false;
const GLOB_DEFAULT = [
  "**/*.{ts,tsx}",
  "!node_modules/**",
  INCLUDE_D_TS ? "" : "!**/*.d.ts",
].filter(Boolean);

const toPosix = (p: string) => p.replace(/\\/g, "/");
const rel = (abs: string) => toPosix(path.relative(CWD, abs)) || ".";

function makeMermaid(nodes: string[], edges: Edge[]): string {
  const idMap = new Map<string, string>();
  nodes.forEach((n, i) => idMap.set(n, `n${i + 1}`));
  const header = "```mermaid\ngraph TD";
  const nodeLines = nodes.map((n) => `${idMap.get(n)}["${n}"]`);
  const edgeLines = edges.map(
    (e) => `${idMap.get(e.from)} --> ${idMap.get(e.to)}`
  );
  return [header, ...nodeLines, ...edgeLines, "```"].join("\n");
}

async function main() {
  const project = fs.existsSync("tsconfig.json")
    ? new Project({ tsConfigFilePath: "tsconfig.json" })
    : new Project();

  if (!fs.existsSync("tsconfig.json")) {
    project.addSourceFilesAtPaths(GLOB_DEFAULT);
  }

  const sourceFiles = project.getSourceFiles();
  const edgesSet = new Set<string>();
  const nodeSet = new Set<string>();

  for (const sf of sourceFiles) {
    const from = rel(sf.getFilePath());
    nodeSet.add(from);

    for (const imp of sf.getImportDeclarations()) {
      const targetSf = imp.getModuleSpecifierSourceFile();

      if (targetSf) {
        const toAbs = targetSf.getFilePath();
        console.log(toAbs);
        console.log(toAbs.includes("node_modules"));
        // node_modules 内は除外
        if (toAbs.includes("node_modules")) continue;

        const to = rel(toAbs);
        nodeSet.add(to);
        edgesSet.add(`${from}|||${to}`);
      } else if (INCLUDE_EXTERNAL) {
        const spec = imp.getModuleSpecifierValue();
        console.log(spec);
        console.log(from);
        // 外部パッケージを含めたい場合のみ
        nodeSet.add(spec);
        edgesSet.add(`${from}|||${spec}`);
      }
    }
  }

  const nodes = Array.from(nodeSet).sort();
  const edges: Edge[] = Array.from(edgesSet).map((key) => {
    const [from, to] = key.split("|||");
    return { from: from ?? "", to: to ?? "" };
  });

  const mermaid = makeMermaid(nodes, edges);

  // mdファイルに書き出し
  fs.writeFileSync("deps.md", mermaid, "utf-8");
  console.log(
    "✅ Mermaidグラフを deps.md に出力しました (node_modules は除外)"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
