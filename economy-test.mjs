// catgirl-economy 单元测试：验证白名单切换与失败回滚。
import { apply, Config } from './catgirl-economy.js'

let failed = 0
function check(label, condition) {
  if (!condition) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

const known = new Set([
  'bash', 'read', 'write', 'edit', 'glob', 'grep', 'str_replace_editor',
  'todo_write', 'subagent', 'web_search',
])
const active = new Set()
const registered = []
let handler

const tools = {
  restrict({ allow }) {
    const unknown = allow.filter(name => !known.has(name))
    if (unknown.length) throw new Error(`unknown global tool ${unknown.join(', ')}`)
    const restriction = { allow: [...allow] }
    active.add(restriction)
    return () => active.delete(restriction)
  },
  register(definition) {
    registered.push(definition)
    return () => {}
  },
}
const agent = {
  ctx: {
    tools,
    effect(effect) { return effect() },
  },
}
const ctx = {
  on(event, callback) {
    check('subscribes to agent/created', event === 'agent/created')
    handler = callback
  },
}

apply(ctx, Config())
handler({ agent })

check('one initial restriction is active', active.size === 1)
check('default allow-list is deduplicated and applied', [...active][0].allow.length === 8)
check('enable_tool is registered in the agent scope', registered.length === 1 && registered[0].name === 'enable_tool')

const enableTool = registered[0]
check('already-enabled tool is reported', await enableTool.execute({ name: 'read' }) === 'Tool read is already enabled.')
check('unknown tool is rejected without changing restriction', (await enableTool.execute({ name: 'ghost' })).startsWith('Unknown tool ghost.'))
check('valid hidden tool is enabled', await enableTool.execute({ name: 'subagent' }) === 'Tool subagent is now enabled for this session.')
check('restriction is replaced instead of intersected', active.size === 1 && [...active][0].allow.includes('subagent'))

check('missing profile tool fails gracefully', await enableTool.execute({ name: 'web_fetch' }) === 'Tool web_fetch is supported but unavailable in this profile.')
check('failed unlock restores previous restriction', active.size === 1 && [...active][0].allow.includes('subagent') && ![...active][0].allow.includes('web_fetch'))
check('state remains usable after failed unlock', await enableTool.execute({ name: 'web_search' }) === 'Tool web_search is now enabled for this session.')
check('later valid unlock keeps earlier unlocks', [...active][0].allow.includes('subagent') && [...active][0].allow.includes('web_search'))

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall economy checks passed')
