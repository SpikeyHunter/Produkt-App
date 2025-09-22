import { json } from "@sveltejs/kit";
import { s as supabase } from "../../../../chunks/supabase.js";
const ALLOWED_EMAIL_DOMAINS = ["@produkt.ca", "@newcitygas.com"];
function validateEmail(email) {
  return ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(domain));
}
async function POST({ request, url }) {
  console.log("🔄 Forgot password API called");
  try {
    const body = await request.json();
    const { email } = body;
    if (!email || typeof email !== "string") {
      return json({ success: false, error: "Email is required" }, { status: 400 });
    }
    const trimmedEmail = email.trim().toLowerCase();
    if (!validateEmail(trimmedEmail)) {
      return json({ success: false, error: "You're not allowed to use this email domain" }, { status: 400 });
    }
    console.log("✅ Sending reset email request to Supabase for:", trimmedEmail);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${url.origin}/login/reset-password`
    });
    if (resetError) {
      console.error("💥 Password reset error:", resetError);
    }
    console.log("✅ Request processed. Returning generic success message.");
    return json({
      success: true,
      message: "If an account exists for this email, a password reset link has been sent. Please check your inbox."
    });
  } catch (error) {
    console.error("💥 Unexpected forgot password error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return json({ success: false, error: "An unexpected error occurred: " + errorMessage }, { status: 500 });
  }
}
export {
  POST
};
