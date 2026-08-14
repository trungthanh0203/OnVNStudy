// Client Supabase dùng ở phía trình duyệt (browser).
// CHỈ dùng anon key ở đây — không bao giờ đưa service_role key vào code chạy trên trình duyệt.
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
