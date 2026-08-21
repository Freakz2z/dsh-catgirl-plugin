// neko-renderer 单元测试：验证装饰幂等性、安装与精确恢复。
import { decorate, installRenderer } from './neko-renderer.js'

let failed = 0
function check(label, condition) {
  if (!condition) { failed++; console.error(`FAIL: ${label}`) }
  else console.log(`ok: ${label}`)
}

check('sentence end gets decorated', decorate('完成。') === '完成。喵~ (｡･ω･｡)\n')
check('code block stays untouched', decorate('```js\nconsole.log("好！")\n```') === '```js\nconsole.log("好！")\n``` (｡･ω･｡)\n')
check('empty output stays empty', decorate('') === '')
check('whitespace-only output stays untouched', decorate(' \n') === ' \n')
check('decoration is idempotent', decorate(decorate('完成。')) === '完成。喵~ (｡･ω･｡)\n')
check('existing nya suffix is not duplicated', decorate('完成。喵~') === '完成。喵~ (｡･ω･｡)\n')

const writes = []
const original = { write(chunk) { writes.push(chunk); return chunk.length } }
const internals = { stdout: original }
const dispose = installRenderer(internals)
const patched = internals.stdout
const result = patched.write('验证通过。')

check('installed renderer decorates stdout', writes[0] === '验证通过。喵~ (｡･ω･｡)\n')
check('write return value is preserved', result === writes[0].length)
dispose()
check('dispose restores original stdout', internals.stdout === original)

const staleDispose = installRenderer(internals)
const newer = { write() {} }
internals.stdout = newer
staleDispose()
check('stale disposer does not overwrite a newer renderer', internals.stdout === newer)

let threw = false
try { installRenderer({ stdout: {} }) } catch { threw = true }
check('invalid stdout fails loud', threw)

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nall renderer checks passed')
