/**
 * neko-renderer — 显示层本地渲染：把模型输出的正常文本喵化。
 *
 * 只装饰 headless 最终打印的文本（替换 internals.stdout），会话日志保持
 * 原文，模型上下文不被污染。Web UI 的渲染由客户端插件负责（未来工作）。
 *
 * 注意：替换必须是同步的（createRequire），因为 headless-runner 在 apply
 * 时捕获 stdout；异步 import 的回调会晚于捕获时机。
 */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'

const require = createRequire(import.meta.url)

export const name = 'neko-renderer'

/**
 * Plugin config.
 * - `headlessLibPath`: @deepseek-ai/dsh-headless 的 lib 入口绝对路径。
 *   默认指向 dsh 安装的 profile node_modules（$DSH_HOME/profiles/node_modules）。
 */
export const Config = z.object({
  headlessLibPath: z.string().default(join(homedir(), '.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh-headless', 'lib', 'index.js')),
})

/** 本地渲染：句尾加「喵~」，末尾加颜文字；代码块原样保留。 */
export function decorate(text) {
  const source = String(text)
  if (source.trim() === '') return source

  const trimmed = source.replace(/\n+$/, '')
  if (trimmed.endsWith(' (｡･ω･｡)')) return `${trimmed}\n`

  const parts = trimmed.split(/(```[\s\S]*?```)/g)
  const body = parts.map((part, i) =>
    i % 2 === 1 ? part : part.replace(/([。！？!?])(?!喵~)(?=\s|$|[^。！？!?])/g, '$1喵~'),
  ).join('')
  return `${body} (｡･ω･｡)\n`
}

/** 安装 stdout 装饰器，并返回不会覆盖后续替换的精确恢复函数。 */
export function installRenderer(internals) {
  const original = internals?.stdout
  if (!original || typeof original.write !== 'function') {
    throw new TypeError('neko-renderer requires internals.stdout.write()')
  }

  const patched = Object.create(original)
  Object.defineProperty(patched, 'write', {
    configurable: true,
    enumerable: true,
    value(chunk) {
      return original.write(decorate(String(chunk)))
    },
  })
  internals.stdout = patched

  return () => {
    if (internals.stdout === patched) internals.stdout = original
  }
}

export function apply(ctx, config) {
  ctx.effect(() => {
    try {
      const { internals } = require(config.headlessLibPath)
      return installRenderer(internals)
    } catch {
      // headless bundle 不存在（如 web profile）时跳过，渲染由 UI 层负责。
      return () => {}
    }
  }, 'neko-renderer.stdout()')
}
