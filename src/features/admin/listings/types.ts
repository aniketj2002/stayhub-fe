export interface ListingCheckResult {
  id?: string;
  check_name?: string;
  check_code?: string;
  status?: 'pass' | 'warn' | 'fail';
  outcome?: 'pass' | 'warn' | 'fail';
  message?: string;
  detail?: string;
}

export interface ReviewQueueItem {
  listing_id: string;
  version_id: string;
  version_no: number;
  listing_title: string;
  host_id: string;
  host_name: string;
  host_email: string;
  status: 'draft' | 'submitted' | 'changes_requested' | 'approved' | 'rejected';
  submitted_at: string;
  submitted_age_hours: number;
  check_results: ListingCheckResult[];
  city?: string;
  country?: string;
  property_type?: string;
  photo_url?: string;
  media_ids?: string[];
  review_count?: number;
  rating_avg?: number;
}

export interface FieldDiff {
  old: unknown;
  new: unknown;
}

export interface PhotosDiff {
  added: string[];
  removed: string[];
  reordered: boolean;
}

export interface ListingVersionModel {
  id: string;
  listing_id: string;
  version_no: number;
  status: string;
  title?: string;
  description?: string;
  property_type?: string;
  base_price_minor?: number;
  cleaning_fee_minor?: number;
  currency?: string;
  max_guests?: number;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  house_rules?: string;
  cancellation_policy?: string;
  amenities?: string[];
  media_ids?: string[];
  check_in_time?: string;
  check_out_time?: string;
  submitted_at?: string;
  decided_at?: string;
  decision_note?: string;
}

export interface VersionDiff {
  version_id: string;
  listing_id: string;
  version_no: number;
  status: string;
  submitted_at?: string;
  live_version_id?: string;
  live_version_no?: number;
  field_diffs: Record<string, FieldDiff>;
  photos_diff: PhotosDiff;
  listing_title?: string;
  city?: string;
  country?: string;
  host_name?: string;
  host_email?: string;
  target_version?: ListingVersionModel;
  live_version?: ListingVersionModel;
  check_results?: ListingCheckResult[];
}

export interface ListingDecisionInput {
  note: string;
}

