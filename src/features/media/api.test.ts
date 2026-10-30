import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureAuth } from '../../lib/api';
import { confirmPhoto, presignPhoto, putPhoto, validatePhoto, type PresignedUpload } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
  configureAuth(
    () => null,
    () => {},
  );
});
const upload: PresignedUpload = {
  media: {
    id: 'media-1',
    status: 'pending',
    public_url: 'http://storage.test/photo.png',
    content_type: 'image/png',
    size_bytes: 10,
  },
  upload_url: 'http://storage.test/signed',
  method: 'PUT',
  headers: { 'Content-Type': 'image/png' },
  expires_at: '2030-01-01T00:00:00Z',
};

describe('media contract', () => {
  it('validates the backend content-type and size limits before presigning', () => {
    expect(validatePhoto({ type: 'image/png', size: 20 * 1024 * 1024 })).toBe('');
    expect(validatePhoto({ type: 'image/svg+xml', size: 10 })).not.toBe('');
    expect(validatePhoto({ type: 'image/png', size: 0 })).not.toBe('');
    expect(validatePhoto({ type: 'image/png', size: 20 * 1024 * 1024 + 1 })).not.toBe('');
  });
  it('sends metadata and reads the nested confirmation response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: upload })))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { media: { ...upload.media, status: 'uploaded' } } })),
      );
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    await expect(presignPhoto(file, 'avatar')).resolves.toEqual(upload);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      filename: 'photo.png',
      content_type: 'image/png',
      size_bytes: 5,
      purpose: 'avatar',
    });
    await expect(confirmPhoto('media-1')).resolves.toMatchObject({ media: { status: 'uploaded' } });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/media/media-1/confirm');
  });
  it('uploads binary bytes with only the storage headers and reports progress', async () => {
    const headers: Record<string, string> = {};

    class FakeXHR {
      static instance: FakeXHR;
      constructor() {
        FakeXHR.instance = this;
      }
      upload = {
        onprogress: (_event: { lengthComputable: boolean; loaded: number; total: number }) => {
          void _event;
        },
      };
      status = 200;
      timeout = 0;
      onload = () => {};
      open = vi.fn();
      setRequestHeader = (name: string, value: string) => {
        headers[name] = value;
      };
      send = vi.fn(() => {
        this.upload.onprogress({ lengthComputable: true, loaded: 5, total: 10 });
        this.onload();
      });
      abort = vi.fn();
    }
    vi.stubGlobal('XMLHttpRequest', FakeXHR);
    const progress = vi.fn();
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    await putPhoto(upload, file, progress, new AbortController().signal);
    const xhr = FakeXHR.instance;
    expect(xhr.open).toHaveBeenCalledWith('PUT', upload.upload_url);
    expect(xhr.send).toHaveBeenCalledWith(file);
    expect(headers).toEqual({ 'Content-Type': 'image/png' });
    expect(progress).toHaveBeenCalledWith(50);
  });
});
