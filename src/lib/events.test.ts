import { describe, expect, it, vi } from 'vitest';
import { eventEmitter } from './events';

describe('TypedEventEmitter', () => {
  it('registers listener and fires callback on emit', () => {
    const callback = vi.fn();
    const unbind = eventEmitter.on('reservation:updated', callback);

    eventEmitter.emit('reservation:updated', { reservationId: 'res-123', status: 'confirmed' });
    expect(callback).toHaveBeenCalledWith({ reservationId: 'res-123', status: 'confirmed' });

    unbind();
    eventEmitter.emit('reservation:updated', { reservationId: 'res-456' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('handles once listener and unregisters automatically after first fire', () => {
    const callback = vi.fn();
    eventEmitter.once('listing:updated', callback);

    eventEmitter.emit('listing:updated', { listingId: 'list-1' });
    eventEmitter.emit('listing:updated', { listingId: 'list-2' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({ listingId: 'list-1' });
  });

  it('isolates listeners across different events', () => {
    const resCallback = vi.fn();
    const listingCallback = vi.fn();

    eventEmitter.on('reservation:updated', resCallback);
    eventEmitter.on('listing:updated', listingCallback);

    eventEmitter.emit('reservation:updated', { reservationId: 'res-1' });
    expect(resCallback).toHaveBeenCalledTimes(1);
    expect(listingCallback).not.toHaveBeenCalled();
  });
});

