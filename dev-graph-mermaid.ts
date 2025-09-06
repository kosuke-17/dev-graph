import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";

// ---- config-ish -------------------------------------------------------------
const CWD = process.cwd();
const INCLUDE_EXTERNAL = false; // true にすると外部ライブラリもノード化
const INCLUDE_D_TS = false; // .d.ts を含めるか
const GLOB_DEFAULT = [
  "**/*.{ts,tsx}",
  "!node_modules/**",
  INCLUDE_D_TS ? "" : "!**/*.d.ts",
].filter(Boolean);

// ---- small utils ------------------------------------------------------------
const toPosix = (p: string) => p.replace(/\\/g, "/");
const rel = (abs: string) => toPosix(path.relative(CWD, abs)) || ".";

type Edge = { from: string; to: string };

function makeMermaid(nodes: string[], edges: Edge[]): string {
  const idMap = new Map<string, string>();
  nodes.forEach((n, i) => idMap.set(n, `n${i + 1}`));
  const header = "graph TD";
  const nodeLines = nodes.map((n) => `${idMap.get(n)}["${n}"]`);
  const edgeLines = edges.map(
    (e) => `${idMap.get(e.from)} --> ${idMap.get(e.to)}`
  );
  return [header, ...nodeLines, ...edgeLines].join("\n");
}

function hasTsConfig(): boolean {
  return fs.existsSync(path.join(CWD, "tsconfig.json"));
}

/**
 * 実行結果
 *
 * graph TD
 * n1["agent.ts"]
 * n2["dev-graph-mermaid.ts"]
 * n3["dev-graph.ts"]
 * n4["node_modules/dotenv/config.d.ts"]
 * n5["node_modules/googleapis/build/src/index.d.ts"]
 * n6["node_modules/openai/index.d.ts"]
 * n7["node_modules/ts-morph/lib/ts-morph.d.ts"]
 * n8["tools/addCalender.ts"]
 * n9["tools/addTodo.ts"]
 * n10["tools/auth.ts"]
 * n11["tools/database.ts"]
 * n12["tools/index.ts"]
 * n13["tools/listTodos.ts"]
 * n14["tools/types.ts"]
 * n1 --> n4
 * n1 --> n6
 * n1 --> n12
 * n2 --> n7
 * n3 --> n7
 * n8 --> n5
 * n8 --> n10
 * n9 --> n11
 * n9 --> n14
 * n10 --> n5
 * n11 --> n14
 * n12 --> n8
 * n12 --> n9
 * n12 --> n13
 * n13 --> n11
 * n1 --> n6
 * n1 --> n12
 * n2 --> n7
 * n3 --> n7
 * n8 --> n5
 * n8 --> n10
 * n9 --> n11
 * n9 --> n14
 * n10 --> n5
 * n11 --> n14
 * n12 --> n8
 * n12 --> n9
 * n12 --> n13
 * n13 --> n11
 */
async function main() {
  // tsconfig があればそれを使う（パスエイリアスを正しく解決できる）
  const project = hasTsConfig()
    ? new Project({ tsConfigFilePath: "tsconfig.json" })
    : new Project();

  if (!hasTsConfig()) {
    project.addSourceFilesAtPaths(GLOB_DEFAULT);
  }

  const sourceFiles = project.getSourceFiles();
  const edgesSet = new Set<string>();
  const nodeSet = new Set<string>();

  for (const sf of sourceFiles) {
    const from = rel(sf.getFilePath());
    nodeSet.add(from);

    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();

      // 1) ローカル相対 or 同一ワークスペース（解決できたらローカル扱い）
      const targetSf = imp.getModuleSpecifierSourceFile();
      if (targetSf) {
        const to = rel(targetSf.getFilePath());
        nodeSet.add(to);
        edgesSet.add(`${from}|||${to}`);
        continue;
      }

      // 2) ここに来るのは外部パッケージ（型定義含む）や未解決パス
      if (INCLUDE_EXTERNAL) {
        const label = spec; // パッケージ名をそのままラベルに
        nodeSet.add(label);
        edgesSet.add(`${from}|||${label}`);
      }
    }
  }

  // Mermaid 生成
  const nodes = Array.from(nodeSet).sort();
  const edges: Edge[] = Array.from(edgesSet)
    .map((key) => {
      const [from, to] = key.split("|||");
      return { from: from ?? "", to: to ?? "" };
    })
    .sort((a, b) =>
      a.from === b.from
        ? a.to.localeCompare(b.to)
        : a.from.localeCompare(b.from)
    );

  const mermaid = makeMermaid(nodes, edges);
  console.log(mermaid);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
