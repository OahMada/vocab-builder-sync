import pLimit from 'p-limit';
import browser from 'webextension-polyfill';

import type { PlasmoMessaging } from '@plasmohq/messaging';

import {
  createIPAFieldValue,
  getBlobNameFromUrl,
  invokeAnkiConnect,
  sendNotification,
} from '../../helpers';

interface UpdateFieldsParam {
  id: number;
  fields: Record<keyof AddNoteParam['fields'], string>;
}

interface AddNoteParam {
  deckName: string;
  modelName: string;
  fields: {
    Sentence: string;
    Translation: string;
    Note: string;
    dbID: string;
    IPA: string;
    Audio: string;
  };
  audio?: {
    url: string;
    filename: string;
    fields: string[];
  }[];
}

interface AppData {
  id: string;
  note: string | null;
  sentence: string;
  pieces: {
    id: string;
    word: string;
    IPA: string;
    index: number;
  }[];
  translation: string;
  audioUrl: string;
}

const modelName = 'Custom: Vocab Builder';
const deckName = 'Vocab Builder';
var css = `
@font-face {
  font-family: "Roboto";
  src: url("_Roboto.woff2") format("woff2");
  font-style: normal;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

* {
  margin: 0;
}

body {
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

input,
button,
textarea,
select {
  font: inherit;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  overflow-wrap: break-word;
}

p {
  text-wrap: pretty;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  text-wrap: balance;
}

html,
body {
  height: 100%;
}

.card {
  font-family: 'Roboto', sans-serif;
  font-size: 16px;
  padding: 30px 20px;
  margin: 0;
  text-align: start;
}

.replay-button svg {
  width: 30px;
  height: 30px;
}

.sentence {
  font-weight: 500;
  margin-bottom: 10px;
}

.ipa {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0;
  margin-bottom: 10px;
  margin-top: 10px;
}

.ipa li {
  border: 1px solid black;
  border-radius: 10px;
  padding: 5px;
  font-size: 14px;
}

body.nightMode .ipa li {
  border: 1px solid lightgrey;
}

.ipa:empty {
  display: none;
}

.audio {
  position: fixed;
  left: 20px;
  bottom: 20px;
  filter: drop-shadow(0px 4px 4px hsla(0, 0%, 0%, 0.3));
}

.translation {
  margin-bottom: 10px;
}

.note {
  white-space: pre-wrap;
  background-color: lightgrey;
  border-radius: 10px;
  padding: 8px;
}

body.nightMode .note {
  background-color: hsl(0, 0%, 12%);
}

.note:empty {
  display: none;
}

.input {
  margin-bottom: 10px;
}
`;

async function handleSync(msg: string) {
  let appData = JSON.parse(msg) as AppData[];

  // check AnkiConnect
  try {
    await invokeAnkiConnect('version');
  } catch (err) {
    console.error(err);
    sendNotification(
      'Error: Anki is not running or AnkiConnect is not installed.',
    );
    return;
  }

  // setup deck
  try {
    let decks: string[] = await invokeAnkiConnect('deckNames');
    if (!decks.includes(deckName)) {
      await invokeAnkiConnect('createDeck', { deck: deckName });
    }
    let modals: string[] = await invokeAnkiConnect('modelNames');
    if (!modals.includes(modelName)) {
      await invokeAnkiConnect('createModel', {
        modelName,
        inOrderFields: [
          'Sentence',
          'Audio',
          'IPA',
          'Translation',
          'Note',
          'dbID',
        ],
        css,
        isCloze: false,
        cardTemplates: [
          {
            Name: 'Basic',
            Front:
              '<p class="sentence">{{Sentence}}</p><ul class="ipa">{{IPA}}</ul><div class="audio">{{Audio}}</div>',
            Back: '{{FrontSide}}<hr id="answer"><p class="translation">{{Translation}}</p><p class="note">{{Note}}</p>',
          },
          {
            Name: 'Reverse',
            Front: '<p class="translation">{{Translation}}</p>',
            Back: '{{FrontSide}}<hr id="answer"><p class="sentence">{{Sentence}}</p><ul class="ipa">{{IPA}}</ul><p class="note">{{Note}}</p><div class="audio">{{Audio}}</div>',
          },
          {
            Name: 'Type',
            Front:
              '<div class="input">{{type:Sentence}}</div><p class="translation">{{Translation}}</p><div class="audio">{{Audio}}</div>',
            Back: '{{FrontSide}}<hr id="answer"><ul class="ipa">{{IPA}}</ul><p class="note">{{Note}}</p>',
          },
        ],
      });

      // setup font
      let fontResponse = await fetch(
        browser.runtime.getURL('/assets/Roboto.woff2'),
      );
      let fontBuffer = await fontResponse.arrayBuffer();
      let base64Font = btoa(String.fromCharCode(...new Uint8Array(fontBuffer)));
      await invokeAnkiConnect('storeMediaFile', {
        filename: '_Roboto.woff2',
        data: base64Font,
      });
    }
  } catch (err) {
    console.error('Failed to setup deck:', err);
    sendNotification('Error: Failed to setup deck.');
    return;
  }

  // fetch existing notes
  let existingNotes: any[] = [];
  try {
    existingNotes = await invokeAnkiConnect('notesInfo', {
      query: `deck:"${deckName}"`,
    });
  } catch (err) {
    console.error('Failed to fetch existing notes:', err);
    sendNotification('Error: Failed to fetch existing notes.');
    return;
  }

  let existingNotesMap = new Map();
  for (let note of existingNotes) {
    if (note.fields.dbID?.value)
      existingNotesMap.set(note.fields.dbID.value, note);
  }

  // prepare add/update/delete
  let toAdd: AddNoteParam[] = [];
  let toUpdate: UpdateFieldsParam[] = [];
  let toDelete: number[] = [];

  for (let item of appData) {
    let note = existingNotesMap.get(item.id);
    let IPAFieldValue = createIPAFieldValue(item.pieces);
    let sentenceNote = item.note ?? '';

    if (!note) {
      let audioFileName = getBlobNameFromUrl(item.audioUrl);
      let noteParam = {
        deckName,
        modelName,
        fields: {
          Sentence: item.sentence,
          Translation: item.translation,
          Note: sentenceNote,
          dbID: item.id,
          IPA: IPAFieldValue,
          Audio: '',
        },
        ...(audioFileName.endsWith('.mp3')
          ? {
              audio: [
                {
                  url: item.audioUrl,
                  filename: audioFileName,
                  fields: ['Audio'],
                },
              ],
            }
          : {}),
        options: {
          duplicateScope: 'deck',
        },
      };
      toAdd.push(noteParam);
    } else {
      let fieldsToUpdate: Record<string, string> = {};
      if (note.fields.Translation.value !== item.translation)
        fieldsToUpdate['Translation'] = item.translation;
      if (note.fields.Note.value !== sentenceNote)
        fieldsToUpdate['Note'] = sentenceNote;
      if (note.fields.IPA.value !== IPAFieldValue)
        fieldsToUpdate['IPA'] = IPAFieldValue;
      if (Object.keys(fieldsToUpdate).length > 0) {
        toUpdate.push({ id: note.noteId, fields: fieldsToUpdate });
      }
    }
  }
  for (let note of existingNotes) {
    if (!appData.find((item) => item.id === note.fields.dbID?.value)) {
      toDelete.push(note.noteId);
    }
  }

  // perform actions
  try {
    for (let note of toAdd) {
      await invokeAnkiConnect('addNote', { note });
    }
  } catch (err) {
    console.error('Add notes failed:', err);
    sendNotification('Error: Failed to add new notes. Sync was not completed.');
    return;
  }

  const batchSize = 100;
  let limit = pLimit(10);
  try {
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      let batch = toUpdate.slice(i, i + batchSize);
      await limit.map(batch, (item) =>
        invokeAnkiConnect('updateNoteFields', { note: item }),
      );
    }
  } catch (err) {
    console.error('Update notes failed:', err);
    sendNotification(
      'Error: Failed to update existing notes. Sync was not completed.',
    );
    return;
  }

  try {
    for (let i = 0; i < toDelete.length; i += batchSize) {
      let batch = toDelete.slice(i, i + batchSize);
      await invokeAnkiConnect('deleteNotes', { notes: batch });
    }
  } catch (err) {
    console.error('Delete notes failed:', err);
    sendNotification(
      'Error: Failed to delete obsolete notes. Sync was not completed.',
    );
    return;
  }

  sendNotification(
    `${toAdd.length} notes added; ${toUpdate.length} notes updated; ${toDelete.length} notes deleted.\nSync completed successfully!`,
  );
}

var handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  res.send({ syncing: true });
  await handleSync(req.body);
  // prevent `Promised response from onMessage listener went out of scope` error in firefox
};

export default handler;
