import { createClient } from '@supabase/supabase-js';

export function createDeleteAccountHandler({ clientFactory = createClient, getEnv = () => process.env } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = getEnv();
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: 'מחיקת החשבון אינה זמינה כרגע. יש לפנות לתמיכה.' });
    }

    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ error: 'יש להתחבר מחדש כדי למחוק את החשבון.' });

    try {
      const authClient = clientFactory(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user) return res.status(401).json({ error: 'פג תוקף החיבור. התחברו מחדש ונסו שוב.' });

      const adminClient = clientFactory(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(data.user.id);
      if (deleteError) return res.status(500).json({ error: 'מחיקת החשבון נכשלה. נסו שוב מאוחר יותר.' });

      return res.status(200).json({ success: true });
    } catch {
      return res.status(500).json({ error: 'מחיקת החשבון נכשלה. נסו שוב מאוחר יותר.' });
    }
  };
}

export default createDeleteAccountHandler();
