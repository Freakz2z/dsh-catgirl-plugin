/**
 * NekoAssistantNode — shadows the default 'assistant-step' renderer
 * (priority -1) and renders assistant blocks with decorated text.
 * Session log stays raw; only the display text is catgirl-ified.
 */
import { memo, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import type { AssistantBlock } from '@deepseek-ai/dsh-client-runtime/client'
import { JsonBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import { ImageGallery, type ImageLoader, type MessageImageLabels } from '@deepseek-ai/dsh-client-ui-attachment'
import type { ChatNodeViewProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { decorate } from './decorate.ts'

function imageLabels(t: ChatNodeViewProps<'assistant-step'>['t']): MessageImageLabels {
  return {
    image: t('image.label'),
    open: t('image.openOriginal'),
    openNamed: label => t('image.openOriginalLabel', { label }),
    loading: t('image.loading'),
    loadFailed: t('image.loadFailed'),
    lightbox: {
      dialog: t('image.preview'),
      close: t('image.closePreview'),
    },
  }
}

export const NekoAssistantNode = memo(function NekoAssistantNode({
  node, loadImage, t,
}: ChatNodeViewProps<'assistant-step'>) {
  const data = node.data
  const streaming = data.status === 'running'
  const interrupted = data.status === 'interrupted'
  const blocks = data.blocks
  const imageLoader = loadImage ?? (() => Promise.reject(new Error(t('image.serviceUnavailable'))))
  const codeLabels = useMemo(() => ({ copyLabel: '复制', copiedLabel: '已复制' }), [])
  const last = blocks.length - 1
  const hasVisible = streaming
    || interrupted
    || blocks.some(block => block.kind !== 'tool-call')
  if (!hasVisible) return null
  const rendered: ReactNode[] = []
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    if (block === undefined) continue
    switch (block.kind) {
      case 'text':
        rendered.push(
          <MarkdownText
            key={i}
            text={decorate(block.text)}
            streaming={streaming}
            codeLabels={codeLabels}
          />,
        )
        break
      case 'reasoning':
        rendered.push(
          <div
            key={i}
            style={{ color: 'var(--dsw-text-secondary, #888)', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}
          >
            {block.text}
          </div>,
        )
        break
      case 'image': {
        const start = i
        const group: { kind: 'image'; attachment: ImageAttachmentRef }[] = [block]
        while (i + 1 < blocks.length) {
          const next = blocks[i + 1]
          if (next === undefined || next.kind !== 'image') break
          group.push(next)
          i += 1
        }
        rendered.push(
          <ImageGallery
            key={start}
            images={group.map(block => ({ attachment: block.attachment }))}
            load={imageLoader}
            align="start"
            labels={imageLabels(t)}
          />,
        )
        break
      }
      case 'tool-call':
        break
      default:
        rendered.push(
          <JsonBlock
            key={i}
            label={t('message.unknownBlock')}
            payload={block.block}
            truncatedLabel={total => t('json.truncated', { total })}
          />,
        )
    }
  }
  return (
    <div data-streaming={streaming || undefined}>
      {rendered}
      {interrupted && <span>{t('message.stopped')}</span>}
    </div>
  )
})
