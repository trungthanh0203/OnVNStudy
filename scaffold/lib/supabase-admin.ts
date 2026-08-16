// Client Supabase dùng service_role key — CHỈ được import từ code chạy PHÍA SERVER
// (route handlers trong app/api/.../route.ts). KHÔNG BAO GIỜ import file này vào
// component có 'use client' ở đầu file — service_role key có toàn quyền trên toàn
// bộ dữ liệu (bỏ qua mọi RLS), lộ ra trình duyệt là mất an toàn cho cả hệ thống.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      'Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường phía server. ' +
        'Khi chạy "next dev" cần có trong .env.local; khi đã deploy lên Cloudflare Worker cần đặt bằng lệnh ' +
        '"wrangler secret put SUPABASE_SERVICE_ROLE_KEY" (xem HUONG-DAN-TRIEN-KHAI.md, Bước 11).'
    );
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
