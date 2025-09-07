import path from 'path'
import { SourceFile } from 'ts-morph'

import { COMPONENT_CENTRIC, CWD } from './settings'

/**
 * パスを POSIX 形式に変換
 */
export const toPosix = (p: string) => p.replace(/\\/g, '/')

/**
 * 相対パスを取得
 */
export const relFromCwd = (abs: string) =>
  toPosix(path.relative(CWD, abs)) || '.'

/**
 * 内部パスかどうかを判定
 */
export function isInternal(absPath: string): boolean {
  const posix = toPosix(absPath)
  // TODO: ここの処理を調べる
  if (!posix.startsWith(toPosix(CWD) + '/')) return false
  if (posix.includes('/node_modules/')) return false
  return true
}

/**
 * 対象パスかどうかを判定
 */
export function isInTargets(rel: string): boolean {
  if (!COMPONENT_CENTRIC) return rel.startsWith('src/')
  if (rel.startsWith('app/')) return true

  return (
    rel.startsWith('src/components/') ||
    rel.startsWith('src/pages/') ||
    rel.startsWith('src/app/')
  )
}

/**
 * ラベル整形（index.* はディレクトリ名代表）
 */
export function prettyLabelByArea(absPath: string): string {
  const rel = relFromCwd(absPath) // ex) src/components/Button/index.tsx
  const p = toPosix(rel).replace(/^src\//, '') // ex) components/Button/index.tsx
  const dir = path.posix.dirname(p)
  const base = path.posix.basename(p, path.extname(p))
  return base.toLowerCase() === 'index' ? dir : `${dir}/${base}`
}

/**
 * Mermaid生成（ノードIDは連番で安全に）
 */
export function toMermaid(
  nodes: string[],
  edges: { from: string; to: string }[]
): string {
  const idMap = new Map<string, string>()
  nodes.forEach((n, i) => idMap.set(n, `n${i + 1}`))
  const header = '```mermaid\ngraph TD'
  const nodeLines = nodes.map((n) => `${idMap.get(n)}["${n}"]`)
  const edgeLines = edges.map(
    (e) => `${idMap.get(e.from)} --> ${idMap.get(e.to)}`
  )
  return [header, ...nodeLines, ...edgeLines, '```'].join('\n')
}

/**
 * 画面ファイル→人間に分かりやすいベース名（ページパスっぽく）
 */
export function screenSlug(sf: SourceFile): string {
  const rel = relFromCwd(sf.getFilePath())
  if (rel.startsWith('src/app/')) {
    // src/axpp/blog/[slug]/page.tsx → app/blog/[slug]
    return toPosix(path.posix.dirname(rel.replace(/^src\//, '')))
  }
  if (rel.startsWith('src/pages/')) {
    // src/pages/index.tsx → pages/index
    // src/pages/about.tsx → pages/about
    return rel.replace(/^src\//, '').replace(/\.(t|j)sx?$/, '')
  }
  return rel.replace(/^src\//, '')
}
