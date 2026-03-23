import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * 로그인 세션(쿠키)이 필요 없는 서버 작업용.
 * Server Action에서 @supabase/ssr 쿠키 클라이언트는 Vercel 등에서 멈춤이 나는 경우가 있어 분리함.
 */
export function createAnonServerClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createClient(url, anonKey);
}
