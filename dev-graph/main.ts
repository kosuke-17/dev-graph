import fs from 'fs'
import path from 'path'
import { Project } from 'ts-morph'

import { collectDepsForEntry } from './gen-graph'
import { BASE_GLOBS, OUT_DIR, SCREEN_GLOBS } from './settings'
import { screenSlug, toMermaid, toPosix } from './utils'

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const hasTsconfig = fs.existsSync('tsconfig.json')
  const project = hasTsconfig
    ? new Project({ tsConfigFilePath: 'tsconfig.json' })
    : new Project()

  // tsconfig に含まれない場合でも拾えるよう明示追加
  project.addSourceFilesAtPaths([...BASE_GLOBS, ...SCREEN_GLOBS])

  // 画面の起点を列挙
  const entries = project.getSourceFiles(SCREEN_GLOBS)

  if (entries.length === 0) {
    console.warn(
      '⚠️ 画面の起点が見つかりませんでした。SCREEN_GLOBS を調整してください。'
    )
    return
  }

  // 各画面ごとに md を書き出し
  const indexLines: string[] = ['# Screen Dependency Graphs', '']
  for (const entry of entries) {
    const { nodeArr, edgeArr } = collectDepsForEntry(entry)
    const mermaid = toMermaid(nodeArr, edgeArr)

    const slug = screenSlug(entry) // 例: app/blog/[slug] or pages/about
      .replace(/[^\w./\-\[\]]/g, '_') // ファイル名に不向きな文字を避ける
      .replace(/\//g, '__') // サブパスは __ に
    const file = path.join(OUT_DIR, `${slug}.md`)

    fs.writeFileSync(file, mermaid, 'utf-8')
    indexLines.push(
      `- [${slug}](${toPosix(path.relative(OUT_DIR, file)) || '.'})`
    )
  }

  // 一覧のインデックスも出しておく
  const indexMd = path.join(OUT_DIR, 'index.md')
  fs.writeFileSync(indexMd, indexLines.join('\n'), 'utf-8')

  console.log(
    `✅ 画面ごとの依存グラフを ${OUT_DIR}/ に出力しました（${entries.length} 画面）`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
