import fs from "fs";
import path from "path";
import { Project } from "ts-morph";

type Edge = { from: string; to: string };

const CWD = process.cwd();
const INCLUDE_D_TS = false;
const GLOBS = [
  "**/*.{ts,tsx}",
  "!node_modules/**",
  INCLUDE_D_TS ? "" : "!**/*.d.ts",
].filter(Boolean);

const toPosix = (p: string) => p.replace(/\\/g, "/");
const rel = (abs: string) => {
  const r = path.relative(CWD, abs);
  return toPosix(r === "" ? "." : r);
};

function isInternalSource(absPath: string): boolean {
  const posix = toPosix(absPath);
  // 自作コードのみ: node_modules 配下は除外
  if (posix.includes("/node_modules/")) return false;
  // プロジェクトルート配下のみ（外のファイルに逃げた場合に備え）
  const relPath = path.relative(CWD, absPath);
  if (relPath.startsWith("..")) return false;
  return true;
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

  if (!hasTsconfig) {
    project.addSourceFilesAtPaths(GLOBS);
  }

  const edgesSet = new Set<string>();
  const nodeSet = new Set<string>();

  for (const sf of project.getSourceFiles()) {
    const fromAbs = sf.getFilePath();
    if (!isInternalSource(fromAbs)) continue; // 念のため
    const from = rel(fromAbs);
    nodeSet.add(from);

    // import ... from "..."
    for (const imp of sf.getImportDeclarations()) {
      const target = imp.getModuleSpecifierSourceFile();
      if (!target) continue; // 外部パッケージ/未解決はスキップ
      const toAbs = target.getFilePath();
      if (!isInternalSource(toAbs)) continue;
      const to = rel(toAbs);
      if (to === from) continue;
      edgesSet.add(`${from}|||${to}`);
      nodeSet.add(to);
    }

    // export ... from "..."（re-export）
    for (const exp of sf.getExportDeclarations()) {
      const target = exp.getModuleSpecifierSourceFile();
      if (!target) continue; // 外部/未解決はスキップ
      const toAbs = target.getFilePath();
      if (!isInternalSource(toAbs)) continue;
      const to = rel(toAbs);
      if (to === from) continue;
      edgesSet.add(`${from}|||${to}`);
      nodeSet.add(to);
    }

    // dynamic import("...") も拾う
    for (const call of sf.getDescendantsOfKind(
      // @ts-ignore: 型は ts-morph が持っているのでランタイムでOK
      (require("ts-morph") as typeof import("ts-morph")).SyntaxKind
        .CallExpression
    )) {
      const exp = call.getExpression();
      if (exp.getText() !== "import") continue;
      const arg = call.getArguments()[0];
      if (!arg || !arg.asKind) continue;
      // 文字列リテラルのみ対象
      const lit = arg.asKind(
        // @ts-ignore
        (require("ts-morph") as typeof import("ts-morph")).SyntaxKind
          .StringLiteral
      );
      if (!lit) continue;
      const target = sf.getProject().getSourceFile(lit.getLiteralText());
      // 文字列→ファイル解決は難しいので、moduleSpecifierSourceFile に近い網羅を狙う
      // ここは importDeclarations で大半は拾えるため、簡易対応：解決できないなら無視
      if (!target) continue;
      const toAbs = target.getFilePath();
      if (!isInternalSource(toAbs)) continue;
      const to = rel(toAbs);
      if (to === from) continue;
      edgesSet.add(`${from}|||${to}`);
      nodeSet.add(to);
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
  fs.writeFileSync("deps.md", mermaid, "utf-8");
  console.log("✅ deps.md に“自作コードのみ”の依存グラフを書き出しました。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
