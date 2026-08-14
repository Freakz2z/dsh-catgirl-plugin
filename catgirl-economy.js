/**
 * catgirl-economy — Token Optimizer：工具 schema 裁剪。
 *
 * 在 agent 创建时（agent/created，早于首次 prompt assembly）把模型可见的
 * 工具裁剪到最小编码集。被隐藏的工具 schema 不再进入每个请求，直接省下
 * 数百到数千 token/请求。裁剪在 agent 作用域内进行，与 lookup/execute
 * 保持一致（ctx.tools.restrict 的语义保证）。
 */

import z from '@deepseek-ai/schemastery'

export const name = 'catgirl-economy'

/** 最小编码工具集：bash + 文件读写编辑 + 搜索 + todo。 */
const DEFAULT_ALLOW = [
  'bash',
  'read',
  'write',
  'edit',
  'glob',
  'grep',
  'str_replace_editor',
  'todo_write',
]

/**
 * Plugin config.
 * - `allow`: 保留的工具名列表（其余全局工具对模型隐藏）。
 */
export const Config = z.object({
  allow: z.array(z.string()).default(DEFAULT_ALLOW),
})

export function apply(ctx, config) {
  ctx.on('agent/created', ({ agent }) => {
    agent.ctx.effect(() => agent.ctx.tools.restrict({ allow: config.allow }), 'catgirl-economy.restrict()')
  })
}
