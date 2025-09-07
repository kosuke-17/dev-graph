import { SourceFile } from 'ts-morph'

import { TRANSITIVE } from './settings'
import { isInTargets, isInternal, prettyLabelByArea, relFromCwd } from './utils'

/**
 * 画面の依存グラフを構築
 */
export function collectDepsForEntry(entry: SourceFile) {
  const nodes = new Set<string>()
  const edges = new Set<string>() // "from|||to"
  const visited = new Set<string>()

  visit(visited, nodes, edges, entry, 0)

  const nodeArr = Array.from(nodes).sort()
  const edgeArr = Array.from(edges)
    .map((k) => {
      const [from, to] = k.split('|||')
      return { from: from ?? '', to: to ?? '' }
    })
    .sort((a, b) =>
      a.from === b.from
        ? a.to.localeCompare(b.to)
        : a.from.localeCompare(b.from)
    )

  return { nodeArr, edgeArr }
}

/**
 * エッジを追加
 */
const addEdge = (
  nodes: Set<string>,
  edges: Set<string>,
  fromAbs: string,
  toAbs: string
) => {
  const toRel = relFromCwd(toAbs)
  if (!isInTargets(toRel)) return // 対象領域以外は無視（自作でも範囲外は除外）
  const from = prettyLabelByArea(fromAbs)
  const to = prettyLabelByArea(toAbs)
  if (from === to) return
  nodes.add(from)
  nodes.add(to)
  edges.add(`${from}|||${to}`)
}

/**
 */
const visit = (
  visited: Set<string>,
  nodes: Set<string>,
  edges: Set<string>,
  sf: SourceFile,
  depth: number
) => {
  const abs = sf.getFilePath()
  if (!isInternal(abs)) return
  const key = abs
  if (visited.has(key)) return
  visited.add(key)

  // 起点ノードも追加
  nodes.add(prettyLabelByArea(abs))

  for (const imp of sf.getImportDeclarations()) {
    if (imp.isTypeOnly?.()) continue // 型importは除外
    const target = imp.getModuleSpecifierSourceFile()
    if (!target) continue // 外部は無視
    const toAbs = target.getFilePath()

    // node_modulesなどのpathはスキップ
    if (!isInternal(toAbs)) continue

    // 指定したpathでなければスキップ
    if (!isInTargets(relFromCwd(toAbs))) continue

    addEdge(nodes, edges, abs, toAbs)
    if (TRANSITIVE) visit(visited, nodes, edges, target, depth + 1)
  }

  // re-export
  for (const exp of sf.getExportDeclarations()) {
    const target = exp.getModuleSpecifierSourceFile()
    if (!target) continue
    const toAbs = target.getFilePath()
    if (!isInternal(toAbs)) continue
    if (!isInTargets(relFromCwd(toAbs))) continue
    addEdge(nodes, edges, abs, toAbs)
    if (TRANSITIVE) visit(visited, nodes, edges, target, depth + 1)
  }
}
