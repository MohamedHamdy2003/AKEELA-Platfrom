export type Role = 'Customer' | 'Restaurant' | 'Delivery_Company' | 'Admin';
export interface Account {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
export interface NewAccount {
  full_name: string;
  email: string;
  phone_number: string;
  password_hash: string;
  role: Role;
}
