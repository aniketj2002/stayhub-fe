export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  media_ids: string[];
  media_urls?: string[];
  flags: string[];
  warning?: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  reservation_id: string;
  reservation_code?: string;
  reservation_status?: string;
  check_in_date?: string;
  check_out_date?: string;
  guests?: number;
  listing_id: string;
  listing_title: string;
  listing_city?: string;
  listing_cover_url?: string;
  host_id?: string;
  host_name?: string;
  guest_id: string;
  guest_name: string;
  last_message?: Message | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

export interface SendMessageInput {
  body: string;
  media_ids?: string[];
}

export interface MessageListResponse {
  messages: Message[];
  has_more: boolean;
  next_cursor?: string | null;
}

