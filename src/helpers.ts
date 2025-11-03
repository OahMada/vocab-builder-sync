import browser from 'webextension-polyfill';

function handleError(error: unknown): string {
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    message = String(error.message);
  } else if (typeof error === 'string') {
    message = error;
  } else {
    message = 'Something went wrong';
  }
  return message;
}

export async function invokeAnkiConnect(
  action: string,
  params: Record<string, any> = {},
) {
  try {
    let response = await fetch('http://127.0.0.1:8765', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        version: 6,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }

    let data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    return data.result;
  } catch (error: any) {
    let errMsg = handleError(error);
    throw new Error(`AnkiConnect request failed: ${errMsg}`);
  }
}

function wrapIPAWithSlashes(IPA: string) {
  if (!IPA.startsWith('/')) {
    IPA = `/${IPA}`;
  }
  if (!IPA.endsWith('/')) {
    IPA = `${IPA}/`;
  }
  return IPA;
}

export function getBlobNameFromUrl(url: string): string {
  let urlParts = url.split('/').filter(Boolean);
  let blobName = urlParts.at(-1) as string;
  return blobName;
}

export function createIPAFieldValue(pieces: { word: string; IPA: string }[]) {
  if (pieces?.length > 0) {
    return pieces
      .map((p) => `<li>${p.word}: ${wrapIPAWithSlashes(p.IPA)}</li>`)
      .join('');
  } else {
    return '';
  }
}

export function sendNotification(message: string) {
  browser.notifications.create({
    type: 'basic',
    iconUrl: browser.runtime.getURL('/assets/icon.png'),
    title: 'Vocab Builder',
    message,
  });
}
