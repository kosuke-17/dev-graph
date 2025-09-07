import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

type Edge = { from: string; to: string };

const CWD = process.cwd();

// 対象: components / pages / app の .tsx（必要なら .ts も追加可）
const GLOBS = [
  "src/**/*.{ts,tsx}",
  "app/**/*.{ts,tsx}",
  "!**/__tests__/**",
  "!**/*.test.*",
  "!**/*.spec.*",
  "!node_modules/**",
  "!**/*.d.ts",
];

const toPosix = (p: string) => p.replace(/\\/g, "/");
const relFromCwd = (abs: string) => toPosix(path.relative(CWD, abs)) || ".";

const isUnderTargets = (rel: string, isApp: boolean) => {
  if (isApp) {
    return rel.startsWith("app/");
  }

  return (
    rel.startsWith("src/components/") ||
    rel.startsWith("src/pages/") ||
    rel.startsWith("src/app/")
  );
};

function isInternal(absPath: string): boolean {
  const posix = toPosix(absPath);
  if (!posix.startsWith(toPosix(CWD) + "/")) return false;
  if (posix.includes("/node_modules/")) return false;
  return true;
}

// 例: src/components/Button/index.tsx → components/Button
//     src/components/Card/Card.tsx     → components/Card/Card
function componentLabel(absPath: string): string {
  const rel = relFromCwd(absPath); // ex) src/components/Button/index.tsx
  const p = toPosix(rel).replace(/^src\//, ""); // ex) components/Button/index.tsx
  const dir = path.posix.dirname(p); // ex) components/Button
  const base = path.posix.basename(p, path.extname(p));
  return base.toLowerCase() === "index" ? dir : `${dir}/${base}`;
}

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
  const hasTsconfig = fs.existsSync("tsconfig.json");
  const project = hasTsconfig
    ? new Project({ tsConfigFilePath: "tsconfig.json" })
    : new Project();

  if (!hasTsconfig) project.addSourceFilesAtPaths(GLOBS);

  const edgesSet = new Set<string>();
  const nodeSet = new Set<string>();

  // ★ 起点（from）ファイル自体も、対象ディレクトリに限定 ★
  for (const sf of project.getSourceFiles(GLOBS)) {
    const fromAbs = sf.getFilePath();
    if (!isInternal(fromAbs)) continue;

    const fromRel = relFromCwd(fromAbs);
    if (!isUnderTargets(fromRel, true)) continue; // ← これが重要

    const from = componentLabel(fromAbs);
    nodeSet.add(from);

    // import ... from "..."
    for (const imp of sf.getImportDeclarations()) {
      if (imp.isTypeOnly?.()) continue; // 型専用importは無視
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue; // 外部は無視

      const toAbs = target.getFilePath();
      if (!isInternal(toAbs)) continue;

      const toRel = relFromCwd(toAbs);
      if (!isUnderTargets(toRel, true)) continue; // ← 依存先も対象範囲に限定

      const to = componentLabel(toAbs);
      if (to === from) continue;
      nodeSet.add(to);
      edgesSet.add(`${from}|||${to}`);
    }

    // export ... from "..."（re-export）
    for (const exp of sf.getExportDeclarations()) {
      const target = exp.getModuleSpecifierSourceFile();
      if (!target) continue;

      const toAbs = target.getFilePath();
      if (!isInternal(toAbs)) continue;

      const toRel = relFromCwd(toAbs);
      if (!isUnderTargets(toRel, true)) continue;

      const to = componentLabel(toAbs);
      if (to === from) continue;
      nodeSet.add(to);
      edgesSet.add(`${from}|||${to}`);
    }
  }

  const nodes = Array.from(nodeSet).sort();
  const edges: Edge[] = Array.from(edgesSet)
    .map((k) => {
      const [from, to] = k.split("|||");
      return { from: from ?? "", to: to ?? "" };
    })
    .sort((a, b) =>
      a.from === b.from
        ? a.to.localeCompare(b.to)
        : a.from.localeCompare(b.from)
    );

  const mermaid = makeMermaid(nodes, edges);
  fs.writeFileSync("components-deps.md", mermaid, "utf-8");
  console.log(
    "✅ components-deps.md に React コンポーネント依存グラフを書き出しました（自作 & 対象ディレクトリのみ）"
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
