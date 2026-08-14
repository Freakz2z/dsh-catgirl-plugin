/** Host registration: the client half does all the work; this half exists so the Loader row resolves. */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'catgirl-plugin-client'

export function apply(_ctx: Context): void {
  // The browser half (src/client) registers the conversation renderer.
}
