export interface User {
  id: string;
  email: string;
  full_name: string;
  is_guest: boolean;
  is_host: boolean;
  avatar_media_id?: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
}
export interface Admin {
  id: string;
  email: string;
  full_name: string;
  created_at?: string;
}
export type Identity =
  | { subject_type: 'user'; user: User; admin?: never }
  | { subject_type: 'admin'; admin: Admin; user?: never };
export type Tokens = Identity & { access_token: string; refresh_token: string; expires_in: number };
