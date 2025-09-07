/**
 * 出力先のディレクトリ
 *
 * @example
 *
 * ```
 * graphs/screens
 * ```
 */
export const OUT_DIR = 'graphs/screens'

/**
 * 現在のディレクトリ(current working directory)
 *
 * @example
 *
 * ```
 * /Users/user/projects/my-project
 * ```
 *
 *
 */
export const CWD = process.cwd()

/**
 * 画面の起点（Pages Router / App Router 両対応）
 *
 * @example
 *
 * ```
 * app/backlog/*.{ts,tsx}
 * ```
 */
export const SCREEN_GLOBS = [
  // Pages Router: /src/pages/**/*.tsx から画面を拾う（特殊ファイルは除外）
  // 'src/pages/**/*.{ts,tsx}',
  // '!src/pages/**/_app.*',
  // '!src/pages/**/_document.*',
  // '!src/pages/**/_error.*',
  // '!src/pages/**/__*__/**',
  // '!src/pages/**/*.test.*',
  // '!src/pages/**/*.spec.*',
  // App Router: /src/app/**/page.tsx
  // 'src/app/**/page.{ts,tsx}',
  // '!src/app/**/__*__/**',
  // '!src/app/**/*.test.*',
  // '!src/app/**/*.spec.*',
  'app/backlog/*.{ts,tsx}',
  'app/blogs/*.{ts,tsx}',
  'app/ai-articles/*.{ts,tsx}',
  'app/desktop/*.{ts,tsx}',
  'app/escape-game/*.{ts,tsx}',
  'app/retro-desktop/*.{ts,tsx}',
  'app/use-sync-external-store/*.{ts,tsx}',
  'app/contact/*.{ts,tsx}',
]

/**
 * 自作コードのみ（node_modules完全除外）
 */
export const INCLUDE_D_TS = false
export const BASE_GLOBS = [
  '**/*.{ts,tsx}',
  '!node_modules/**',
  INCLUDE_D_TS ? '' : '!**/*.d.ts',
].filter(Boolean)

/**
 * 依存の対象を「コンポーネント中心」に絞る（true推奨）
 */
export const COMPONENT_CENTRIC = true

/**
 * 直接依存のみならfalse、再帰的（推奨）ならtrue
 */
export const TRANSITIVE = true
