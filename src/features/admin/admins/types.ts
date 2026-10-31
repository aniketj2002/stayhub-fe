import type { AdminRole } from '../../auth/types';

export interface AdminOverride {
  admin_id: string;
  permission: string;
  granted: boolean;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole | string;
  permissions: string[];
  overrides?: AdminOverride[];
  created_at: string;
  updated_at: string;
}

export interface AdminListResponse {
  admins: AdminUserDetail[];
  count: number;
}

export interface CreateAdminInput {
  email: string;
  password: string;
  full_name: string;
  role: AdminRole | string;
}

export interface UpdateAdminInput {
  role?: AdminRole | string;
  permissions?: Record<string, boolean>;
}

