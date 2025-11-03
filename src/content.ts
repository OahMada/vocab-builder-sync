import type { PlasmoCSConfig } from 'plasmo';

import { getPort } from '@plasmohq/messaging/port';

import type { AppData } from '~types';

interface PageMessage {
  type: 'sync';
  payload: AppData[];
}

var targetOrigin =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3000'
    : 'https://vocab-builder.app';

var matches =
  process.env.NODE_ENV === 'development'
    ? [
        'https://vocab-builder.app/*',
        'https://www.vocab-builder.app/*',
        'http://localhost:*/*',
      ]
    : ['https://vocab-builder.app/*', 'https://www.vocab-builder.app/*'];

export var config: PlasmoCSConfig = {
  matches,
  run_at: 'document_end',
};

window.addEventListener('message', (event: MessageEvent<PageMessage>) => {
  if (event.source !== window) return; // only accept messages from the same page
  if (event.data.type === 'sync') {
    let syncPort = getPort('sync');
    syncPort.postMessage({
      body: event.data.payload,
    });
    window.postMessage({ type: 'syncing' }, targetOrigin);
  }
});
