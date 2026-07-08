import { describe, expect, it, vi } from 'vitest';
import { writeClipboardText } from './clipboard';

describe('writeClipboardText', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);

    await writeClipboardText('copy me', {
      clipboard: {
        writeText,
      },
    });

    expect(writeText).toHaveBeenCalledWith('copy me');
  });

  it('falls back to a temporary text area when Clipboard API is unavailable', async () => {
    const textArea = createTestTextArea();
    const appendToBody = vi.fn<(textArea: HTMLTextAreaElement) => void>();
    const execCopy = vi.fn<() => boolean>().mockReturnValue(true);

    await writeClipboardText('fallback copy', {
      createTextArea: () => textArea,
      appendToBody,
      execCopy,
    });

    expect(textArea.value).toBe('fallback copy');
    expect(textArea.style.position).toBe('fixed');
    expect(textArea.style.opacity).toBe('0');
    expect(appendToBody).toHaveBeenCalledWith(textArea);
    expect(textArea.focus).toHaveBeenCalled();
    expect(textArea.select).toHaveBeenCalled();
    expect(execCopy).toHaveBeenCalled();
    expect(textArea.remove).toHaveBeenCalled();
  });

  it('removes the temporary text area when fallback copy fails', async () => {
    const textArea = createTestTextArea();

    await expect(
      writeClipboardText('copy failure', {
        createTextArea: () => textArea,
        appendToBody: () => undefined,
        execCopy: () => false,
      })
    ).rejects.toThrow('Failed to copy text');
    expect(textArea.remove).toHaveBeenCalled();
  });

  it('rejects when neither Clipboard API nor fallback DOM hooks are available', async () => {
    await expect(writeClipboardText('copy failure', {})).rejects.toThrow('Clipboard fallback is unavailable');
  });
});

function createTestTextArea(): HTMLTextAreaElement {
  return {
    value: '',
    style: {
      position: '',
      top: '',
      left: '',
      opacity: '',
    } as CSSStyleDeclaration,
    focus: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
  } as unknown as HTMLTextAreaElement;
}
