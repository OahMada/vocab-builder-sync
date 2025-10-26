import type { PlasmoCSConfig } from 'plasmo';

import { relayMessage } from '@plasmohq/messaging';

export var config: PlasmoCSConfig = {
  matches: ['https://vocab-builder.app/*', 'https://www.vocab-builder.app/*'],
  run_at: 'document_end',
};

relayMessage({
  name: 'sync',
});
