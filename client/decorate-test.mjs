// decorate 单元测试：验证喵化逻辑（与 server 侧 neko-renderer 一致）。
import { decorate } from './src/client/decorate.ts'

let failed = 0
function check(label, cond) {
  if (!cond) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

check('sentence end gets 喵~', decorate('验证通过。') === '验证通过。喵~ (｡･ω･｡)')
check('multiple sentences', decorate('完成。正确。') === '完成。喵~正确。喵~ (｡･ω･｡)')
check('code block untouched', decorate('结果：\n```python\nprint("ok。")\n```\n完成。') === '结果：\n```python\nprint("ok。")\n```\n完成。喵~ (｡･ω･｡)')
check('no punctuation still gets kaomoji', decorate('Done') === 'Done (｡･ω･｡)')
check('trailing newline trimmed', decorate('完成。\n') === '完成。喵~ (｡･ω･｡)')
check('english punctuation', decorate('All tests pass!') === 'All tests pass!喵~ (｡･ω･｡)')

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall decorate checks passed')
