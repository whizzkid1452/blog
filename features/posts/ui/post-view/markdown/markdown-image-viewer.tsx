'use client';

/* eslint-disable @next/next/no-img-element */
import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import styles from './markdown-content.module.css';

const MARKDOWN_IMAGE_SIZES = '(max-width: 768px) 100vw, 768px';
const FULL_SCREEN_IMAGE_SIZES = '100vw';

interface MarkdownImageSize {
  width: number;
  height: number;
}

interface MarkdownImageViewerProps {
  src: string;
  alt: string;
  title?: string;
  size: MarkdownImageSize | null;
}

interface RenderedMarkdownImageProps extends MarkdownImageViewerProps {
  className: string;
  sizes: string;
}

export function MarkdownImageViewer({ src, alt, title, size }: MarkdownImageViewerProps) {
  const accessibleImageName = alt.trim() === '' ? '이미지' : alt;

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <button
          className={styles.markdownImageZoomTrigger}
          type="button"
          aria-label={`${accessibleImageName} 전체 화면으로 보기`}
        >
          <RenderedMarkdownImage
            className={styles.markdownImage}
            src={src}
            alt={alt}
            title={title}
            size={size}
            sizes={MARKDOWN_IMAGE_SIZES}
          />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.markdownImageZoomOverlay} data-motion-overlay="backdrop" />
        <Dialog.Content className={styles.markdownImageZoomContent} data-motion-overlay="centered-dialog">
          <Dialog.Title className={styles.visuallyHidden}>{accessibleImageName} 전체 화면 보기</Dialog.Title>
          <Dialog.Description className={styles.visuallyHidden}>
            Esc 키 또는 닫기 버튼을 눌러 원래 화면으로 돌아갈 수 있습니다.
          </Dialog.Description>
          <RenderedMarkdownImage
            className={styles.markdownImageZoomExpandedImage}
            src={src}
            alt={alt}
            title={title}
            size={size}
            sizes={FULL_SCREEN_IMAGE_SIZES}
          />
          <Dialog.Close
            className={styles.markdownImageZoomCloseButton}
            data-motion="pressable"
            type="button"
            aria-label="전체 화면 이미지 닫기"
          >
            닫기
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function RenderedMarkdownImage({ className, src, alt, title, size, sizes }: RenderedMarkdownImageProps) {
  if (size == null) {
    return <img className={className} src={src} alt={alt} title={title} loading="lazy" decoding="async" />;
  }

  return (
    <Image
      className={className}
      src={src}
      alt={alt}
      title={title}
      width={size.width}
      height={size.height}
      sizes={sizes}
    />
  );
}
