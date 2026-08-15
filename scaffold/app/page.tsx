'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      router.push(session ? '/home' : '/login');
    }
    check();
  }, []);

  return <div style={{ padding: 24 }}>Đang tải...</div>;
}
