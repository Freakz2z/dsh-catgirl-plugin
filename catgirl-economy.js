/**
 * catgirl-economy — Token Optimizer：工具 schema 裁剪 + 渐进式披露。
 *
 * 在 agent 创建时（agent/created，早于首次 prompt assembly）把模型可见的
 * 工具裁剪到最小编码集。被隐藏的工具 schema 不再进入每个请求，直接省下
 * 数百到数千 token/请求。
 *
 * 渐进式披露（escalate）：注册一个极小的 `enable_tool` 工具（~50 token），
 * 模型需要被裁的工具（subagent、web_search 等）时调用它，插件在 agent
 * 作用域内解除对应工具的隐藏。这是 docs 推荐的 ToolSearch / progressive
 * disclosure 模式：registry 保持 presentation、lookup、execution 一致。
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

/** 可被 enable_tool 解锁的隐藏工具。 */
const ESCALATABLE = [
  'subagent',
  'send_message',
  'list_agents',
  'interrupt_agent',
  'report',
  'web_fetch',
  'web_search',
  'skill',
  'workflow',
  'ralph',
  'ask_user_question',
  'read_image',
  'get_goal',
  'create_goal',
  'update_goal',
  'job_output',
  'job_list',
  'job_kill',
]

/**
 * Plugin config.
 * - `allow`: 初始保留的工具名列表（其余全局工具对模型隐藏）。
 * - `escalate`: 注册 `enable_tool` 工具，允许模型按需解锁隐藏工具。
 */
export const Config = z.object({
  allow: z.array(z.string()).default(DEFAULT_ALLOW),
  escalate: z.boolean().default(true),
})

export function apply(ctx, config) {
  ctx.on('agent/created', ({ agent }) => {
    const state = { allow: [...new Set(config.allow)], disposer: null }
    const replaceRestriction = (nextAllow) => {
      const previousAllow = state.allow
      const hadRestriction = state.disposer !== null
      state.disposer?.()
      state.disposer = null

      try {
        const nextDisposer = agent.ctx.tools.restrict({ allow: nextAllow })
        state.allow = nextAllow
        state.disposer = nextDisposer
      } catch (error) {
        // Switching an allow-list requires lifting the old restriction first,
        // because restrictions intersect. Restore it if the new tool is not
        // installed in this profile so one failed unlock cannot poison state.
        if (hadRestriction) {
          state.disposer = agent.ctx.tools.restrict({ allow: previousAllow })
        }
        throw error
      }
    }
    replaceRestriction(state.allow)

    if (config.escalate) {
      agent.ctx.effect(() => agent.ctx.tools.register({
        name: 'enable_tool',
        description: 'Add a hidden tool to this session when you need one that is not currently available. Hidden tools include: subagent, web_search, web_fetch, skill, workflow, ralph, ask_user_question, read_image, goal/job/report tools.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'The exact tool name to enable',
            },
          },
          required: ['name'],
        },
        output: {
          schema: { type: 'string' },
          render: (_args, value) => [{ type: 'text', text: value }],
        },
        async execute(args) {
          if (state.allow.includes(args.name)) return `Tool ${args.name} is already enabled.`
          if (!ESCALATABLE.includes(args.name)) {
            return `Unknown tool ${args.name}. Escalatable tools: ${ESCALATABLE.join(', ')}.`
          }
          try {
            replaceRestriction([...state.allow, args.name])
            return `Tool ${args.name} is now enabled for this session.`
          } catch {
            return `Tool ${args.name} is supported but unavailable in this profile.`
          }
        },
      }), 'catgirl-economy.enable_tool()')
    }
  })
}
