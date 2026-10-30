import { useEffect, useRef, useState } from 'react';
import { Badge, Button } from '../../components/ui';
import {
  allowedTypes,
  confirmPhoto,
  presignPhoto,
  putPhoto,
  validatePhoto,
  type Media,
  type PresignedUpload,
} from './api';

type Item = {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'confirming' | 'done' | 'error';
  progress: number;
  error?: string;
  upload?: PresignedUpload;
  transferred?: boolean;
  media?: Media;
};
export function PhotoUploader({
  purpose = 'listing_photo',
  multiple = true,
  onUploaded,
  onBusyChange,
}: {
  purpose?: 'avatar' | 'listing_photo' | 'evidence';
  multiple?: boolean;
  onUploaded?: (media: Media) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [validation, setValidation] = useState('');
  const uploading = items.some((item) =>
    ['queued', 'uploading', 'confirming'].includes(item.status),
  );
  useEffect(() => {
    onBusyChange?.(uploading);
  }, [uploading, onBusyChange]);
  const controllers = useRef(new Map<string, AbortController>());
  useEffect(() => {
    const active = controllers.current;
    return () => {
      active.forEach((controller) => controller.abort());
    };
  }, []);
  const patch = (id: string, update: Partial<Item>) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...update } : item)));
  async function run(item: Item) {
    if (controllers.current.has(item.id)) return;
    const controller = new AbortController();
    controllers.current.set(item.id, controller);
    let upload = item.upload;
    let transferred = item.transferred;
    patch(item.id, { status: 'uploading', error: undefined, progress: 0 });
    try {
      if (!transferred) {
        if (!upload || new Date(upload.expires_at).getTime() <= Date.now())
          upload = await presignPhoto(item.file, purpose, controller.signal);
        patch(item.id, { upload });
        await putPhoto(
          upload,
          item.file,
          (progress) => patch(item.id, { progress }),
          controller.signal,
        );
        transferred = true;
      }
      patch(item.id, { transferred, status: 'confirming', progress: 100 });
      if (!upload) throw new Error('Upload could not be found. Select the photo again.');
      const result = await confirmPhoto(upload.media.id, controller.signal);
      if (result.media.status !== 'uploaded')
        throw new Error('The server has not confirmed this photo. Try again.');
      if (controller.signal.aborted) return;
      patch(item.id, { status: 'done', media: result.media });
      onUploaded?.(result.media);
    } catch (error) {
      if (!controller.signal.aborted)
        patch(item.id, {
          status: 'error',
          upload,
          transferred,
          error: error instanceof Error ? error.message : 'Unable to upload photo.',
        });
    } finally {
      controllers.current.delete(item.id);
    }
  }
  return (
    <section className="photo-uploader" aria-label="Photo upload">
      <label className="upload-picker">
        <strong>{multiple ? 'Add photos' : 'Upload a photo'}</strong>
        <span>JPEG, PNG, WebP, AVIF or GIF · up to 20 MB each</span>
        <input
          aria-label={purpose === 'avatar' ? 'Choose profile photo' : 'Choose photos'}
          type="file"
          accept={allowedTypes.join(',')}
          multiple={multiple}
          onChange={(event) => {
            const selected = Array.from(event.target.files || []);
            const errors = selected
              .map((file) => (validatePhoto(file) ? `${file.name}: ${validatePhoto(file)}` : ''))
              .filter(Boolean);
            setValidation(errors.join(' '));
            const next: Item[] = selected
              .filter((file) => !validatePhoto(file))
              .map((file) => ({ id: crypto.randomUUID(), file, status: 'queued', progress: 0 }));
            setItems((current) => [...current, ...next]);
            next.forEach((item) => void run(item));
            event.target.value = '';
          }}
        />
      </label>
      {validation && (
        <p role="alert" className="field-error">
          {validation}
        </p>
      )}
      <p className="muted" aria-live="polite">
        {items.filter((item) => item.status === 'done').length} confirmed{' '}
        {items.filter((item) => item.status === 'done').length === 1 ? 'photo' : 'photos'}
      </p>
      <ul className="upload-list">
        {items.map((item) => (
          <li key={item.id}>
            <div className="upload-info">
              <strong>{item.file.name}</strong>
              {item.status === 'done' ? (
                <Badge tone="positive">Uploaded</Badge>
              ) : (
                <span role="status">
                  {item.status === 'confirming'
                    ? 'Confirming upload…'
                    : item.status === 'error'
                      ? 'Upload failed'
                      : `Uploading ${item.progress}%`}
                </span>
              )}
            </div>
            {(item.status === 'uploading' || item.status === 'queued') && (
              <progress
                max="100"
                value={item.progress}
                aria-label={`Uploading ${item.file.name}`}
              />
            )}
            {item.error && <p role="alert">{item.error}</p>}
            {item.status === 'error' && (
              <Button variant="secondary" onClick={() => void run(item)}>
                Retry {item.transferred ? 'confirmation' : 'upload'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
