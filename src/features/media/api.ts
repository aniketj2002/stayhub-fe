import { request } from '../../lib/api';

export interface Media {
  id: string;
  status: string;
  public_url: string;
  content_type: string;
  size_bytes: number;
}
export interface PresignedUpload {
  media: Media;
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  expires_at: string;
}
export const allowedTypes = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
];
export function validatePhoto(file: Pick<File, 'type' | 'size'>) {
  if (!allowedTypes.includes(file.type)) return 'Choose a JPEG, PNG, WebP, AVIF, or GIF image.';
  if (file.size <= 0 || file.size > 20 * 1024 * 1024)
    return 'Photos must be between 1 byte and 20 MB.';
  return '';
}
export function presignPhoto(
  file: File,
  purpose: 'avatar' | 'listing_photo' | 'evidence',
  signal?: AbortSignal,
) {
  return request<PresignedUpload>('/api/v1/media/presign', {
    method: 'POST',
    body: { filename: file.name, content_type: file.type, size_bytes: file.size, purpose },
    signal,
  });
}
export function confirmPhoto(id: string, signal?: AbortSignal) {
  return request<{ media: Media }>(`/api/v1/media/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
    body: {},
    signal,
  });
}
export function getMedia(id: string, signal?: AbortSignal) {
  return request<{ media: Media }>(`/api/v1/media/${encodeURIComponent(id)}`, { signal });
}

// Direct object-storage upload: never send API bearer tokens or request IDs to storage.
export function putPhoto(
  upload: PresignedUpload,
  file: File,
  progress: (percent: number) => void,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve();
    };
    if (signal.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    xhr.open(upload.method, upload.upload_url);
    xhr.timeout = 120_000;
    Object.entries(upload.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) progress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () =>
      finish(
        xhr.status >= 200 && xhr.status < 300
          ? undefined
          : new Error('Photo upload was rejected. Try again.'),
      );
    xhr.onerror = () =>
      finish(new Error('Could not upload the photo. Check your connection and try again.'));
    xhr.ontimeout = () => finish(new Error('Photo upload timed out. Try again.'));
    xhr.onabort = () => finish(new DOMException('Cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    xhr.send(file);
  });
}
