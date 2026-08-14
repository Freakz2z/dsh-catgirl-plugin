// usage-meter — 测量插件：在 llm/stream 瀑布上抓取 usage chunk，追加写入文件。
// 用于对比不同配置下的真实 token 用量（含 cache read/write）。
import { appendFile } from 'node:fs/promises'

export const name = 'usage-meter'

export const inject = ['llm']

export function apply(ctx, config = {}) {
  const outputPath = config.outputPath ?? '/tmp/dsh-usage.jsonl'
  ctx.on('llm/stream', (options, next) => {
    const stream = next()
    return (async function* () {
      for await (const chunk of stream) {
        if (chunk.type === 'usage') {
          await appendFile(outputPath, JSON.stringify({
            time: Date.now(),
            provider: options.provider,
            model: options.model,
            ...chunk.usage,
          }) + '\n')
        }
        yield chunk
      }
    })()
  })
}
