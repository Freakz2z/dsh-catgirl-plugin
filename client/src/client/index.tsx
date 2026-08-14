/**
 * Neko web client entry: shadows the default assistant-step renderer with a
 * decorated one. Session log stays raw; only the display text is catgirl-ified.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { NekoAssistantNode } from './NekoAssistantNode.tsx'

export const name = 'catgirl-plugin-client'

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'assistant-step',
    priority: -1,
    locale: 'conversation',
  }, NekoAssistantNode))
}
