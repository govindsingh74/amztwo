import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
if (!supabaseUrl || !supabaseAnonKey || 
    supabaseUrl === 'your_supabase_project_url_here' || 
    supabaseAnonKey === 'your_supabase_anon_key_here') {
  console.error('⚠️  Supabase environment variables are not configured properly.');
  console.error('Please update your .env file with your actual Supabase credentials.');
  console.error('You can find these in your Supabase project dashboard under Settings > API');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          auth_id: string;
          first_name: string;
          last_name: string;
          email: string;
          mobile: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_id: string;
          first_name: string;
          last_name: string;
          email: string;
          mobile?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          email?: string;
          mobile?: string | null;
          updated_at?: string;
        };
      };
      user_addresses: {
        Row: {
          id: string;
          user_id: string;
          label: string;
          address_line1: string;
          address_line2: string;
          city: string;
          state: string;
          country: string;
          pincode: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          label?: string;
          address_line1: string;
          address_line2?: string;
          city: string;
          state: string;
          country?: string;
          pincode: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          label?: string;
          address_line1?: string;
          address_line2?: string;
          city?: string;
          state?: string;
          country?: string;
          pincode?: string;
          is_default?: boolean;
        };
      };
    };
  };
};