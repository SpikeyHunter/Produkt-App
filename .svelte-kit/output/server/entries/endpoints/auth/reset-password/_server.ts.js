import { json } from "@sveltejs/kit";
import { s as supabase } from "../../../../chunks/supabase.js";
function validatePassword(password) {
  return password.length >= 8;
}
async function POST({ request }) {
  console.log("🔄 Reset password API called");
  try {
    const body = await request.json();
    const { password, accessToken, refreshToken } = body;
    if (!password || typeof password !== "string") {
      return json({
        success: false,
        error: "Password is required"
      }, { status: 400 });
    }
    if (!accessToken || !refreshToken) {
      return json({
        success: false,
        error: "Invalid or expired reset link"
      }, { status: 400 });
    }
    if (!validatePassword(password)) {
      return json({
        success: false,
        error: "Password must contain at least 8 characters"
      }, { status: 400 });
    }
    console.log("🔑 Setting session with reset tokens...");
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (sessionError || !sessionData.session?.user) {
      console.error("💥 Session error:", sessionError);
      return json({
        success: false,
        error: "Invalid or expired reset link"
      }, { status: 400 });
    }
    console.log("🔄 Updating password...");
    const { error: updateError } = await supabase.auth.updateUser({
      password
    });
    if (updateError) {
      console.error("💥 Password update error:", updateError);
      return json({
        success: false,
        error: "Failed to update password. Please try again."
      }, { status: 500 });
    }
    console.log("✅ Password updated successfully");
    await supabase.auth.signOut();
    return json({
      success: true,
      message: "Password updated successfully! Please log in with your new password."
    });
  } catch (error) {
    console.error("💥 Unexpected reset password error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return json({
      success: false,
      error: "An unexpected error occurred: " + errorMessage
    }, { status: 500 });
  }
}
export {
  POST
};
