import { redirect } from "@sveltejs/kit";
import { s as supabase } from "../../../../chunks/supabase.js";
async function GET({ url, cookies }) {
  console.log("🔗 Auth callback called");
  console.log("🔍 URL:", url.toString());
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  if (error) {
    console.error("❌ Auth callback error:", error, errorDescription);
    throw redirect(302, `/?error=${encodeURIComponent(errorDescription || error)}`);
  }
  if (code) {
    console.log("🔐 Processing auth code...");
    const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
    if (sessionError) {
      console.error("💥 Session exchange error:", sessionError);
      throw redirect(302, `/?error=${encodeURIComponent("Email verification failed")}`);
    }
    if (sessionData.session && sessionData.user) {
      console.log("✅ Session established for user:", sessionData.user.id);
      cookies.set("sb-access-token", sessionData.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: sessionData.session.expires_in || 3600,
        path: "/"
      });
      cookies.set("sb-refresh-token", sessionData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 30,
        // 30 days
        path: "/"
      });
      console.log("✅ Session cookies set successfully");
      throw redirect(302, "/dashboard?verified=true");
    }
  }
  console.log("🔄 No code found, redirecting to verification page");
  throw redirect(302, "/auth/verify");
}
export {
  GET
};
