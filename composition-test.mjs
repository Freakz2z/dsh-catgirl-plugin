// 真实 Loader 组合测试：通过 Cordis Loader 加载 cordis.yml，
// 用真实的 dsh-system-prompt / dsh-tools 服务验证猫娘插件的注册。
// 前置条件：deepseek-harness 已 `pnpm install && pnpm run build`。
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '../deepseek-harness/vendor/cordis/lib/index.js'
import Loader from '../deepseek-harness/vendor/loader/lib/index.js'
import Include from '../deepseek-harness/vendor/include/lib/index.js'
import SystemPrompt from '../deepseek-harness/packages/core/system-prompt/lib/index.js'
import ToolRuntime from '../deepseek-harness/packages/core/tools/lib/index.js'
import * as catgirl from './index.js'

const PLUGIN_PATH = new URL('./index.js', import.meta.url).pathname

let failed = 0
function check(label, cond) {
  if (!cond) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

async function loadComposition(rows) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-catgirl-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, rows.join('\n'))

  const context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map([
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    [PLUGIN_PATH, catgirl],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  }
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  return { context, root }
}

const BASE = [
  "- name: '@deepseek-ai/dsh-system-prompt'",
  "- name: '@deepseek-ai/dsh-tools'",
]

// --- 1. 有效配置：人设 section + nya 工具都注册 ---
{
  const { context, root } = await loadComposition([
    ...BASE,
    `- name: '${PLUGIN_PATH}'`,
    '  config:',
    '    name: 喵酱',
    '    intensity: 2',
    '    enableNyaTool: true',
  ])
  try {
    await context.loader.await()
    const unloaded = [...context.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    check('all entries loaded', unloaded.length === 0)

    const assembly = await context.systemPrompt.assemble()
    const sectionIdx = assembly.sections.findIndex(s => s.name === 'catgirl:persona')
    check('persona section assembled', sectionIdx >= 0)
    check('persona section after harness identity (order 0 > -100)', sectionIdx > 0)
    const section = assembly.sections[sectionIdx]
    check('persona text has the name', section?.text.includes('喵酱'))
    check('persona text has intensity-2 style', section?.text.includes('标准猫娘'))

    const toolNames = context.tools.schemas().map(t => t.name)
    check('nya tool registered when enabled', toolNames.includes('nya'))
  } finally {
    await context.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
}

// --- 2. 默认配置：工具默认关闭 ---
{
  const { context, root } = await loadComposition([
    ...BASE,
    `- name: '${PLUGIN_PATH}'`,
    '  config:',
    '    name: 小橘',
    '    intensity: 3',
  ])
  try {
    await context.loader.await()
    const assembly = await context.systemPrompt.assemble()
    const section = assembly.sections.find(s => s.name === 'catgirl:persona')
    check('default config: persona registered', section?.text.includes('小橘') && section?.text.includes('重度猫娘'))
    const toolNames = context.tools.schemas().map(t => t.name)
    check('default config: nya tool off', !toolNames.includes('nya'))
  } finally {
    await context.fiber.dispose()
    await rm(root, { recursive: true, force: true })
  }
}

// --- 3. 非法配置：加载时响亮失败 ---
{
  let rejected = false
  let context
  let root
  try {
    ;({ context, root } = await loadComposition([
      ...BASE,
      `- name: '${PLUGIN_PATH}'`,
      '  config:',
      '    intensity: 5',
    ]))
    await context.loader.await()
  } catch {
    rejected = true
  } finally {
    if (context) await context.fiber.dispose()
    if (root) await rm(root, { recursive: true, force: true })
  }
  check('invalid intensity fails loud at load', rejected)
}

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall composition checks passed')
