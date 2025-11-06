import type { PlasmoCSConfig } from 'plasmo';

import { relayMessage } from '@plasmohq/messaging';

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

relayMessage({
  name: 'sync',
});
