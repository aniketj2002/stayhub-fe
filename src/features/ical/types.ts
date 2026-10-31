export interface ICalFeed {
  id: string;
  listing_id: string;
  name: string;
  url: string;
  last_synced_at?: string | null;
  last_sync_error?: string | null;
  created_at: string;
}

export interface CreateICalFeedInput {
  name: string;
  url: string;
}

export interface ICalExportResponse {
  export_url: string;
  token: string;
}

