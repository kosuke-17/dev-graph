import fs from "fs";
import path from "path";
import { Project, SourceFile } from "ts-morph";

// ===== 設定 =========================================================
const OUT_DIR = "graphs/screens";
const CWD = process.cwd();

// 画面の起点（Pages Router / App Router 両対応）
const SCREEN_GLOBS = [
  // Pages Router: /src/pages/**/*.tsx から画面を拾う（特殊ファイルは除外）
  "src/pages/**/*.{ts,tsx}",
  "!src/pages/**/_app.*",
  "!src/pages/**/_document.*",
  "!src/pages/**/_error.*",
  "!src/pages/**/__*__/**",
  "!src/pages/**/*.test.*",
  "!src/pages/**/*.spec.*",
  // App Router: /src/app/**/page.tsx
  "src/app/**/page.{ts,tsx}",
  "!src/app/**/__*__/**",
  "!src/app/**/*.test.*",
  "!src/app/**/*.spec.*",
];

// 自作コードのみ（node_modules完全除外）
const INCLUDE_D_TS = false;
const BASE_GLOBS = [
  "**/*.{ts,tsx}",
  "!node_modules/**",
  INCLUDE_D_TS ? "" : "!**/*.d.ts",
].filter(Boolean);

// 依存の対象を「コンポーネント中心」に絞る（true推奨）
const COMPONENT_CENTRIC = true;

// 直接依存のみならfalse、再帰的（推奨）ならtrue
const TRANSITIVE = true;

// ===== ユーティリティ ================================================
const toPosix = (p: string) => p.replace(/\\/g, "/");
const relFromCwd = (abs: string) => toPosix(path.relative(CWD, abs)) || ".";

function isInternal(absPath: string): boolean {
  const posix = toPosix(absPath);
  if (!posix.startsWith(toPosix(CWD) + "/")) return false;
  if (posix.includes("/node_modules/")) return false;
  return true;
}

function isInTargets(rel: string): boolean {
  if (!COMPONENT_CENTRIC) return rel.startsWith("src/");
  return (
    rel.startsWith("src/components/") ||
    rel.startsWith("src/pages/") ||
    rel.startsWith("src/app/")
  );
}

// ラベル整形（index.* はディレクトリ名代表）
function prettyLabelByArea(absPath: string): string {
  const rel = relFromCwd(absPath); // ex) src/components/Button/index.tsx
  const p = toPosix(rel).replace(/^src\//, ""); // ex) components/Button/index.tsx
  const dir = path.posix.dirname(p);
  const base = path.posix.basename(p, path.extname(p));
  return base.toLowerCase() === "index" ? dir : `${dir}/${base}`;
}

// Mermaid生成（ノードIDは連番で安全に）
function toMermaid(
  nodes: string[],
  edges: { from: string; to: string }[]
): string {
  const idMap = new Map<string, string>();
  nodes.forEach((n, i) => idMap.set(n, `n${i + 1}`));
  const header = "```mermaid\ngraph TD";
  const nodeLines = nodes.map((n) => `${idMap.get(n)}["${n}"]`);
  const edgeLines = edges.map(
    (e) => `${idMap.get(e.from)} --> ${idMap.get(e.to)}`
  );
  return [header, ...nodeLines, ...edgeLines, "```"].join("\n");
}

// 画面ファイル→人間に分かりやすいベース名（ページパスっぽく）
function screenSlug(sf: SourceFile): string {
  const rel = relFromCwd(sf.getFilePath());
  if (rel.startsWith("src/app/")) {
    // src/app/blog/[slug]/page.tsx → app/blog/[slug]
    return toPosix(path.posix.dirname(rel.replace(/^src\//, "")));
  }
  if (rel.startsWith("src/pages/")) {
    // src/pages/index.tsx → pages/index
    // src/pages/about.tsx → pages/about
    return rel.replace(/^src\//, "").replace(/\.(t|j)sx?$/, "");
  }
  return rel.replace(/^src\//, "");
}

// ===== 依存グラフ構築 ================================================
function collectDepsForEntry(entry: SourceFile, project: Project) {
  const nodes = new Set<string>();
  const edges = new Set<string>(); // "from|||to"
  const visited = new Set<string>();

  const pushEdge = (fromAbs: string, toAbs: string) => {
    const fromRel = relFromCwd(fromAbs);
    const toRel = relFromCwd(toAbs);
    if (!isInTargets(toRel)) return; // 対象領域以外は無視（自作でも範囲外は除外）
    const from = prettyLabelByArea(fromAbs);
    const to = prettyLabelByArea(toAbs);
    if (from === to) return;
    nodes.add(from);
    nodes.add(to);
    edges.add(`${from}|||${to}`);
  };

  const visit = (sf: SourceFile, depth: number) => {
    const abs = sf.getFilePath();
    if (!isInternal(abs)) return;
    const key = abs;
    if (visited.has(key)) return;
    visited.add(key);

    // 起点ノードも追加
    nodes.add(prettyLabelByArea(abs));

    for (const imp of sf.getImportDeclarations()) {
      if (imp.isTypeOnly?.()) continue; // 型importは除外
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue; // 外部は無視
      const toAbs = target.getFilePath();
      if (!isInternal(toAbs)) continue;
      if (!isInTargets(relFromCwd(toAbs))) continue;
      pushEdge(abs, toAbs);
      if (TRANSITIVE) visit(target, depth + 1);
    }

    // re-export
    for (const exp of sf.getExportDeclarations()) {
      const target = exp.getModuleSpecifierSourceFile();
      if (!target) continue;
      const toAbs = target.getFilePath();
      if (!isInternal(toAbs)) continue;
      if (!isInTargets(relFromCwd(toAbs))) continue;
      pushEdge(abs, toAbs);
      if (TRANSITIVE) visit(target, depth + 1);
    }
  };

  visit(entry, 0);

  const nodeArr = Array.from(nodes).sort();
  const edgeArr = Array.from(edges)
    .map((k) => {
      const [from, to] = k.split("|||");
      return { from: from ?? "", to: to ?? "" };
    })
    .sort((a, b) =>
      a.from === b.from
        ? a.to.localeCompare(b.to)
        : a.from.localeCompare(b.from)
    );

  return { nodeArr, edgeArr };
}

// ===== メイン ========================================================
async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const hasTsconfig = fs.existsSync("tsconfig.json");
  const project = hasTsconfig
    ? new Project({ tsConfigFilePath: "tsconfig.json" })
    : new Project();

  // tsconfig に含まれない場合でも拾えるよう明示追加
  project.addSourceFilesAtPaths([...BASE_GLOBS, ...SCREEN_GLOBS]);

  // 画面の起点を列挙
  const entries = project.getSourceFiles(SCREEN_GLOBS);

  if (entries.length === 0) {
    console.warn(
      "⚠️ 画面の起点が見つかりませんでした。SCREEN_GLOBS を調整してください。"
    );
    return;
  }

  // 各画面ごとに md を書き出し
  const indexLines: string[] = ["# Screen Dependency Graphs", ""];
  for (const entry of entries) {
    const { nodeArr, edgeArr } = collectDepsForEntry(entry, project);
    const mermaid = toMermaid(nodeArr, edgeArr);

    const slug = screenSlug(entry) // 例: app/blog/[slug] or pages/about
      .replace(/[^\w./\-\[\]]/g, "_") // ファイル名に不向きな文字を避ける
      .replace(/\//g, "__"); // サブパスは __ に
    const file = path.join(OUT_DIR, `${slug}.md`);

    fs.writeFileSync(file, mermaid, "utf-8");
    indexLines.push(
      `- [${slug}](${toPosix(path.relative(OUT_DIR, file)) || "."})`
    );
  }

  // 一覧のインデックスも出しておく
  const indexMd = path.join(OUT_DIR, "index.md");
  fs.writeFileSync(indexMd, indexLines.join("\n"), "utf-8");

  console.log(
    `✅ 画面ごとの依存グラフを ${OUT_DIR}/ に出力しました（${entries.length} 画面）`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
