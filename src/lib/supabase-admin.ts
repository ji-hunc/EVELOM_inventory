import { createClient } from '@supabase/supabase-js'

// 서버 사이드에서만 사용할 관리자 권한 클라이언트
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)