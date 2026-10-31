export interface FeeConfig {
  id: string;
  guest_fee_bps: number;
  host_fee_bps: number;
  status: 'pending' | 'pending_approval' | 'active' | 'rejected' | 'superseded' | string;
  proposed_by: string;
  approved_by?: string;
  reason: string;
  created_at: string;
  activated_at?: string;
}

export interface FeeConfigListResponse {
  fee_configs: FeeConfig[];
  count: number;
}

export interface ProposeFeeConfigInput {
  guest_fee_bps: number;
  host_fee_bps: number;
  reason: string;
}

export interface RejectFeeConfigInput {
  reason: string;
}

