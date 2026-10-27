
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ngyyznjwiejrzfwwyqlv.supabase.co';

const supabasePublishableKey =
  'sb_publishable_AP0sDz-5grkqkjdj-XZuBQ_Q9yYtTbC';

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  }
);

