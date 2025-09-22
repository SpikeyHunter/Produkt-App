import { json } from "@sveltejs/kit";
import { A as ADMIN_REGISTRATION_CODE, U as USER_REGISTRATION_CODE } from "../../../../chunks/private.js";
const VALID_CODES = [ADMIN_REGISTRATION_CODE, USER_REGISTRATION_CODE];
async function POST({ request }) {
  console.log("🔍 Registration code validation called");
  try {
    const body = await request.json();
    console.log("📝 Validation request:", { code: body.code ? "provided" : "missing" });
    const { code } = body;
    if (!code || typeof code !== "string") {
      console.log("❌ Invalid code format");
      return json({
        isValid: false
      });
    }
    const isValid = VALID_CODES.includes(code.trim());
    console.log("✅ Code validation result:", { code: code.trim(), isValid });
    return json({
      isValid
    });
  } catch (error) {
    console.error("💥 Registration code validation error:", error);
    return json({
      isValid: false
    }, { status: 500 });
  }
}
export {
  POST
};
