// 冒烟测试：用 mock ctx 验证插件注册的人设 section 和 nya 工具。
import { name, inject, apply, Config } from './index.js'

const seen = { sections: [], tools: [] }
const ctx = {
  effect(fn) { fn() },
  systemPrompt: {
    section(section) { seen.sections.push(section); return () => {} },
  },
  tools: {
    register(def) { seen.tools.push(def); return () => {} },
  },
}

let failed = 0
function check(label, cond) {
  if (!cond) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

check('name is catgirl', name === 'catgirl')
check('injects systemPrompt and tools', JSON.stringify(inject) === JSON.stringify(['systemPrompt', 'tools']))

// --- Config schema 校验 ---
const defaults = Config()
check('defaults: name 喵酱', defaults.name === '喵酱')
check('defaults: intensity 2', defaults.intensity === 2)
check('defaults: traits []', Array.isArray(defaults.traits) && defaults.traits.length === 0)
check('defaults: enableNyaTool false', defaults.enableNyaTool === false)

let threw = false
try { Config({ intensity: 5 }) } catch { threw = true }
check('invalid intensity fails loud', threw)

threw = false
try { Config({ name: 42 }) } catch { threw = true }
check('invalid name type fails loud', threw)

// --- 默认配置（工具关）---
apply(ctx, Config())
check('one section registered', seen.sections.length === 1)
const section = seen.sections[0]
check('section name avoids deployment:persona', section.name === 'catgirl:persona')
check('section order is persona slot (0)', section.order === 0)
check('section text mentions the catgirl name', section.text.includes('喵酱'))
check('section text mentions intensity-2 style', section.text.includes('标准猫娘'))
check('no tool registered by default', seen.tools.length === 0)

// --- 开启工具 ---
apply(ctx, Config({ enableNyaTool: true }))
check('one tool registered when enabled', seen.tools.length === 1)
const tool = seen.tools[0]
check('tool name is nya', tool.name === 'nya')
check('tool has mood enum', Object.keys(tool.parameters.properties.mood.enum).length === 5)

const result = await tool.execute({ mood: 'happy' })
check('nya execute returns a string', typeof result === 'string' && result.length > 0)

// --- 自定义配置 ---
seen.sections.length = 0
apply(ctx, Config({ name: '小橘', intensity: 3, traits: ['怕水', '喜欢纸箱'] }))
const custom = seen.sections[0].text
check('custom name applied', custom.includes('小橘'))
check('custom intensity applied', custom.includes('重度猫娘'))
check('custom traits applied', custom.includes('怕水') && custom.includes('喜欢纸箱'))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall checks passed')
