export interface AppEvents {
  'reservation:updated': { reservationId: string; status?: string };
  'listing:updated': { listingId: string };
  'session:expired': void;
  'notification:received': { notificationId: string };
  [key: string]: unknown;
}

type EventCallback<T = unknown> = (data: T) => void;

export class TypedEventEmitter {
  private listeners: Map<string, Set<EventCallback<unknown>>> = new Map();

  on<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): () => void {
    const eventKey = String(event);
    if (!this.listeners.has(eventKey)) {
      this.listeners.set(eventKey, new Set());
    }
    this.listeners.get(eventKey)!.add(callback as EventCallback<unknown>);

    return () => this.off(event, callback);
  }

  off<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): void {
    const eventKey = String(event);
    const set = this.listeners.get(eventKey);
    if (set) {
      set.delete(callback as EventCallback<unknown>);
      if (set.size === 0) {
        this.listeners.delete(eventKey);
      }
    }
  }

  emit<K extends keyof AppEvents>(event: K, data: AppEvents[K]): void {
    const eventKey = String(event);
    const set = this.listeners.get(eventKey);
    if (set) {
      Array.from(set).forEach((callback) => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in event listener for ${eventKey}:`, err);
        }
      });
    }
  }

  once<K extends keyof AppEvents>(event: K, callback: EventCallback<AppEvents[K]>): () => void {
    const unregister = this.on(event, (data) => {
      unregister();
      callback(data);
    });
    return unregister;
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventEmitter = new TypedEventEmitter();
