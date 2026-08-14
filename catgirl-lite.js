/**
 * dsh-catgirl-plugin (lite) — 极短 persona。
 *
 * 设计：模型只输出正常、简洁的文本（极短 persona 约束），猫娘风味由
 * 显示层插件（neko-renderer）本地渲染，不进入会话日志、不污染模型上下文。
 * 相比传统长 persona 方案：每请求省下数百 token 的 persona 文本，且不注册
 * 任何多余工具 schema。
 */

import z from '@deepseek-ai/schemastery'

const PERSONA_SECTION = 'catgirl-lite:persona'
const PERSONA_ORDER = 0

export const name = 'catgirl-lite'

export const inject = ['systemPrompt']

/**
 * Plugin config.
 * - `persona`: 极短模型行为约束（默认 6 token 的英文句）。
 */
export const Config = z.object({
  persona: z.string().default('Be concise, friendly, and natural.'),
})

export function apply(ctx, config) {
  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SECTION,
    order: PERSONA_ORDER,
    text: config.persona,
  }), 'catgirl-lite.persona()')
}
