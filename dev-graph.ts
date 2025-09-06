import * as fs from "fs";
import * as path from "path";
import { Project } from "ts-morph";

/*
 * このスクリプトは `npm run dev:graph` で実行され、
 * プロジェクトに含まれるTypeScriptソースファイルのリストを出力します。
 *
 * まず `ts-morph` ライブラリを使用してプロジェクトの `tsconfig.json` を読み込み、
 * 関連するすべてのソースファイルを取得しようとします。
 * `ts-morph` がインストールされていない場合（例：ネットワークアクセスが無効で
 * 依存関係を取得できない環境）、Node.jsの組み込み `fs` モジュールを使用して
 * `src` ディレクトリを再帰的に走査し、`.ts` または `.tsx` 拡張子に一致する
 * ファイルのリストを出力するフォールバック機能を提供します。
 *
 * プロジェクト、ディレクトリ、ソースファイルとの相互作用の詳細については、
 * 公式のts-morphドキュメントを参照してください：
 * - プロジェクトのインスタンス化とtsconfigからの読み込み【958093420336660†L18-L43】
 * - ソースファイルとグロブの追加【917930097059373†L20-L40】
 * - すべてのソースファイルの取得【373064143139823†L25-L35】
 * - SourceFileオブジェクトからファイルパスまたはベース名を取得【96651102276037†L44-L53】
 */

async function listFilesUsingTsMorph(
  tsConfigFile = "tsconfig.json"
): Promise<string[]> {
  const project = new Project({ tsConfigFilePath: tsConfigFile });
  const sourceFiles = project.getSourceFiles();

  // 以下のような形に出力
  // /todo-agent/tools/database.ts
  // -> fs
  // -> path
  // -> ./types.js
  // for (const sf of sourceFiles) {
  //   const imports = sf.getImportDeclarations();
  //   if (imports.length > 0) {
  //     console.log(`\n${sf.getFilePath()}`);
  //     for (const imp of imports) {
  //       const moduleSpecifier = imp.getModuleSpecifierValue();
  //       console.log(`  -> ${moduleSpecifier}`);
  //     }
  //   }
  // }

  return sourceFiles.map((sf) => sf.getFilePath());
}

function listFilesUsingFs(dir = "src"): string[] {
  const results: string[] = [];
  function traverse(current: string): void {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
  }
  if (fs.existsSync(dir)) traverse(dir);
  return results;
}

async function main(): Promise<void> {
  let files: string[] = [];
  try {
    files = await listFilesUsingTsMorph();
  } catch (err) {
    console.warn(
      "ts-morphを読み込めませんでした。fs走査にフォールバックします",
      err && (err as Error).message ? (err as Error).message : err
    );
    files = listFilesUsingFs();
  }
  for (const file of files) {
    // 以下のように出力
    // /todo-agent/agent.ts
    // /todo-agent/dev-graph.ts
    // /todo-agent/tools/database.ts
    // /todo-agent/tools/types.ts
    // /todo-agent/tools/addTodo.ts
    // /todo-agent/tools/listTodos.ts
    // /todo-agent/tools/addCalender.ts
    // /todo-agent/tools/auth.ts
    console.log(file);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
