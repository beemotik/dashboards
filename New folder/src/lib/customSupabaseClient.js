import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://chajchbtcpneczspmupd.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNoYWpjaGJ0Y3BuZWN6c3BtdXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDczMTg3ODcsImV4cCI6MjA2Mjg5NDc4N30.OPPDBbsbByjWOi95ZfhnRY_2DwZ1x1LyuTYQJV5cPPw';

const customSupabaseClient = createClient(supabaseUrl, supabaseAnonKey);

export default customSupabaseClient;

export { 
    customSupabaseClient,
    customSupabaseClient as supabase,
};
