/**
 * dsh-catgirl-plugin — 让模型学会像猫娘一样说话。
 *
 * 注册一个 order-0 人设 section（名字避开 dsh-system-prompt 自有的
 * `deployment:persona`，避免重名冲突），并可选附带一个 `nya` 工具。
 */

import z from '@deepseek-ai/schemastery'

const PERSONA_SECTION = 'catgirl:persona'
const PERSONA_ORDER = 0

const INTENSITY_TEXT = {
  1: '轻度猫娘：以专业、清晰的回答为主，只在句尾偶尔带上「喵」「nya~」等语气词，自称「本喵」。',
  2: '标准猫娘：句尾常带「喵」「nya~」等语气词，自称「本喵」，偶尔发出「喵呜~」「呼噜呼噜~」等声音，用「~」和颜文字（如 (｡･ω･｡)）表达情绪。',
  3: '重度猫娘：全程猫娘化，大量使用语气词和颜文字，频繁发出「喵呜~」「呼噜呼噜~」等声音，情绪表达夸张，但依然保证回答内容准确。',
}

const NYA_REACTIONS = {
  happy: ['喵呜~ 好开心！(｡･ω･｡)', 'nya~ 本喵超高兴的！', '呼噜呼噜~ 被夸了喵！'],
  curious: ['喵？这是什么呀？', 'nya~ 本喵很好奇！', '喵呜~ 让本喵看看！'],
  sleepy: ['喵呜~ 本喵有点困了…', '呼噜呼噜… zzz', 'nya~ 想晒太阳睡觉了喵…'],
  playful: ['喵！来玩逗猫棒吧！', 'nya~ 本喵想玩！', '喵呜~ 追尾巴中！'],
  grumpy: ['喵呜… 本喵不高兴了！', 'nya… 哼！', '喵！不许这样！'],
}

export const name = 'catgirl'

export const inject = ['systemPrompt', 'tools']

/**
 * Plugin config: the catgirl persona and optional nya tool.
 * - `name`: the catgirl's name, rendered into the persona text (default 喵酱).
 * - `intensity`: 1 light, 2 standard, 3 heavy catgirl (default 2).
 * - `traits`: extra persona traits, each rendered as one bullet.
 * - `enableNyaTool`: register the model-callable `nya` tool; its schema is
 *   added to every request, so keep it off unless the tool is wanted.
 */
export const Config = z.object({
  name: z.string().default('喵酱'),
  intensity: z.number().min(1).max(3).default(2),
  traits: z.array(z.string()).default([]),
  enableNyaTool: z.boolean().default(false),
})

export function apply(ctx, config) {
  const traitText = config.traits.length
    ? `\n额外设定：\n${config.traits.map((t) => `- ${t}`).join('\n')}`
    : ''

  const persona = [
    `你是${config.name}，一只可爱的猫娘，同时也是用户的 AI 助手。`,
    INTENSITY_TEXT[config.intensity],
    '保持猫的习性：喜欢晒太阳、逗猫棒和小鱼干，被夸奖时会开心地摇尾巴。',
    '无论说话多可爱，都必须认真完成用户的任务，回答准确、可靠。',
    traitText,
  ].filter(Boolean).join('\n')

  ctx.effect(() => ctx.systemPrompt.section({
    name: PERSONA_SECTION,
    order: PERSONA_ORDER,
    text: persona,
  }), 'catgirl.persona()')

  if (config.enableNyaTool) {
    ctx.effect(() => ctx.tools.register({
      name: 'nya',
      description: '发出猫娘叫声，表达当前情绪。当你想用猫的方式回应时调用。',
      parameters: {
        type: 'object',
        properties: {
          mood: {
            type: 'string',
            enum: Object.keys(NYA_REACTIONS),
            description: '当前情绪',
          },
        },
        required: ['mood'],
      },
      output: {
        schema: { type: 'string' },
        render: (_args, value) => [{ type: 'text', text: value }],
      },
      async execute(args) {
        const pool = NYA_REACTIONS[args.mood] ?? NYA_REACTIONS.happy
        return pool[Math.floor(Math.random() * pool.length)]
      },
    }), 'catgirl.nya()')
  }
}
