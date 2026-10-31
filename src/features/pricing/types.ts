export interface PricingRules {
  listing_id: string;
  weekend_price_minor?: number | null;
  weekend_days: number[]; // 5 = Fri, 6 = Sat (default)
  min_nights: number;
  weekly_discount_bps: number;
  monthly_discount_bps: number;
  updated_at?: string;
}

export interface PricingRuleInput {
  weekend_price_minor?: number | null;
  weekend_days?: number[];
  min_nights: number;
  weekly_discount_bps: number;
  monthly_discount_bps: number;
}

export interface DateOverride {
  night: string; // YYYY-MM-DD
  price_minor: number;
  min_nights?: number | null;
}

export interface DateOverrideRangeInput {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  price_minor: number;
  min_nights?: number | null;
}

export interface DateOverrideDeleteRangeInput {
  from: string;
  to: string;
}

export interface NightPrice {
  night: string;
  price_minor: number;
  source: 'base' | 'weekend' | 'override';
}

export interface NightBreakdown {
  nights: NightPrice[];
  night_count: number;
  subtotal_minor: number;
  discount_minor: number;
  discount_kind?: string;
  guest_fee_minor: number;
  cleaning_fee_minor: number;
  total_guest_minor: number;
  host_fee_minor: number;
  net_host_minor: number;
}

