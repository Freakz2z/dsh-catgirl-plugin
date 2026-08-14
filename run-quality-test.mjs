// 质量对比测试运行器 v2：每任务独立 usage 文件。
// 用法: node run-quality-test.mjs <label> <config: base|lite> <task>
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'

const DSH = '/Users/freakk/.npm/_npx/1e7f6d9597241db0/node_modules/.bin/dsh'
const PLUGIN_DIR = '/Users/freakk/WorkSpace/Project/DSH/catgirl-plugin'
const [label, config, ...taskWords] = process.argv.slice(2)
const task = taskWords.join(' ')
const usageFile = `/tmp/quality-${label}-${config}.usage.jsonl`
rmSync(usageFile, { force: true })

const overlay = `/tmp/quality-${label}-${config}.overlay.yml`
const rows = [
  `- insert:`,
  `    - id: usage-meter`,
  `      name: '${PLUGIN_DIR}/usage-meter.js'`,
  `      config:`,
  `        outputPath: ${usageFile}`,
]
if (config === 'lite') {
  rows.push(
    `    - id: catgirl-lite`,
    `      name: '${PLUGIN_DIR}/catgirl-lite.js'`,
    `    - id: neko-renderer`,
    `      name: '${PLUGIN_DIR}/neko-renderer.js'`,
    `    - id: catgirl-economy`,
    `      name: '${PLUGIN_DIR}/catgirl-economy.js'`,
  )
}
writeFileSync(overlay, rows.join('\n') + '\n')

try {
  const out = execFileSync(DSH, ['--profile', 'headless', '--patch', overlay, task], {
    encoding: 'utf8',
    timeout: 300_000,
    env: { ...process.env },
  })
  writeFileSync(`/tmp/quality-${label}-${config}.out.txt`, out)
  console.log('OK')
} catch (e) {
  writeFileSync(`/tmp/quality-${label}-${config}.out.txt`, String(e.stdout ?? '') + '\n[EXIT ' + e.status + '] ' + String(e.stderr ?? ''))
  console.log('FAILED exit=' + e.status)
}
