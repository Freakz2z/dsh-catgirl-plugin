/**
 * 本地渲染：句尾加「喵~」，末尾加颜文字；代码块原样保留。
 * 与 server 侧 neko-renderer.js 的 decorate 保持同一逻辑。
 */
export function decorate(text: string): string {
  if (text.trim() === '') return text

  const trimmed = text.replace(/\n+$/, '')
  if (trimmed.endsWith(' (｡･ω･｡)')) return trimmed

  const parts = trimmed.split(/(```[\s\S]*?```)/g)
  const body = parts.map((part, i) =>
    i % 2 === 1 ? part : part.replace(/([。！？!?])(?!喵~)(?=\s|$|[^。！？!?])/g, '$1喵~'),
  ).join('')
  return `${body} (｡･ω･｡)`
}
