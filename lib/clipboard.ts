export interface ClipboardWriteEnvironment {
  clipboard?: ClipboardWriter;
  createTextArea?: () => HTMLTextAreaElement;
  appendToBody?: (textArea: HTMLTextAreaElement) => void;
  execCopy?: () => boolean;
}

interface ClipboardWriter {
  writeText: (text: string) => Promise<void>;
}

export async function writeClipboardText(
  text: string,
  environment: ClipboardWriteEnvironment = createBrowserClipboardWriteEnvironment()
): Promise<void> {
  if (environment.clipboard != null) {
    await environment.clipboard.writeText(text);
    return;
  }

  copyTextWithTextArea(text, environment);
}

function createBrowserClipboardWriteEnvironment(): ClipboardWriteEnvironment {
  const browserDocument = typeof document === 'undefined' ? null : document;

  return {
    clipboard: typeof navigator === 'undefined' ? undefined : navigator.clipboard,
    createTextArea: browserDocument == null ? undefined : () => browserDocument.createElement('textarea'),
    appendToBody: browserDocument == null ? undefined : textArea => browserDocument.body.append(textArea),
    execCopy: browserDocument == null ? undefined : () => browserDocument.execCommand('copy'),
  };
}

function copyTextWithTextArea(text: string, environment: ClipboardWriteEnvironment): void {
  const { createTextArea, appendToBody, execCopy } = environment;

  if (createTextArea == null || appendToBody == null || execCopy == null) {
    throw new Error('Clipboard fallback is unavailable');
  }

  const textArea = createTextArea();
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '0';
  textArea.style.opacity = '0';

  appendToBody(textArea);
  textArea.focus();
  textArea.select();

  try {
    const isCopied = execCopy();

    if (!isCopied) {
      throw new Error('Failed to copy text');
    }
  } finally {
    textArea.remove();
  }
}
