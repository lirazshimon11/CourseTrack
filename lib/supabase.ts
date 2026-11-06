import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://pqeugdbioeybrsjiwmdi.supabase.co';
const supabaseAnonKey = 'sb_publishable_O3R1F4cU71o5LneIa4ytUA_cRwJ4yXv';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: typeof window !== 'undefined',
  },
});
