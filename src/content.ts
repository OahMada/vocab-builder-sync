import type { PlasmoCSConfig } from 'plasmo'

import { sendToBackground } from '@plasmohq/messaging'

export var config: PlasmoCSConfig = {
  matches: [
    'https://vocab-builder.app/*',
    'https://www.vocab-builder.app/*',
    'http://localhost/*',
  ],
  all_frames: false,
  run_at: 'document_end',
}

window.addEventListener('message', async (event) => {
  if (event.source !== window) return
  if (event.data.type === 'sync') {
    await sendToBackground({ name: 'sync', body: event.data.payload })
  }
})
