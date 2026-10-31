export type NotificationChannel = 'email' | 'push' | 'in_app' | 'sms';

export type NotificationType =
  | 'booking'
  | 'payout'
  | 'review'
  | 'case'
  | 'system'
  | 'account';

export interface Notification {
  id: string;
  user_id?: string;
  channel: NotificationChannel | string;
  type?: NotificationType | string;
  title: string;
  body: string;
  read: boolean;
  data?: Record<string, unknown>;
  created_at: string;
  read_at?: string | null;
}

