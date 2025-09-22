import { json } from "@sveltejs/kit";
import { s as supabase } from "../../../../chunks/supabase.js";
import { U as USER_REGISTRATION_CODE, A as ADMIN_REGISTRATION_CODE } from "../../../../chunks/private.js";
const REGISTRATION_CODES = {
  [ADMIN_REGISTRATION_CODE]: "Admin",
  [USER_REGISTRATION_CODE]: "User"
};
const ALLOWED_EMAIL_DOMAINS = ["@produkt.ca", "@newcitygas.com"];
function validateName(name) {
  if (name.length < 2) return false;
  if (/\d/.test(name)) return false;
  return true;
}
function validateEmail(email) {
  return ALLOWED_EMAIL_DOMAINS.some((domain) => email.endsWith(domain));
}
function validatePassword(password) {
  return password.length >= 8;
}
function validateRegistrationCode(code) {
  return REGISTRATION_CODES.hasOwnProperty(code);
}
async function POST({ request, url }) {
  console.log("🚀 Registration API called");
  try {
    const body = await request.json();
    console.log("📝 Registration attempt for:", body.email);
    const { firstName, lastName, email, password, confirmPassword, registrationCode } = body;
    const errors = [];
    if (!validateName(firstName)) {
      errors.push("First name must be at least 2 characters and contain no digits");
    }
    if (!validateName(lastName)) {
      errors.push("Last name must be at least 2 characters and contain no digits");
    }
    if (!validateEmail(email)) {
      errors.push("You're not allowed to register using this email");
    }
    if (!validatePassword(password)) {
      errors.push("Password must contain at least 8 characters");
    }
    if (password !== confirmPassword) {
      errors.push("Password not matching");
    }
    if (!validateRegistrationCode(registrationCode)) {
      errors.push("Invalid registration code");
    }
    if (errors.length > 0) {
      console.log("❌ Validation errors:", errors);
      return json({ success: false, errors }, { status: 400 });
    }
    const userRole = REGISTRATION_CODES[registrationCode];
    console.log("✅ User role determined:", userRole);
    console.log("🔍 Checking if user already exists...");
    const { data: existingProfile } = await supabase.from("user_profiles").select("id, email").eq("email", email.toLowerCase()).single();
    if (existingProfile) {
      console.log("❌ User profile already exists:", existingProfile.email);
      return json({
        success: false,
        errors: ["An account with this email already exists"]
      }, { status: 400 });
    }
    console.log("👤 Creating user with Supabase Auth...");
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.toLowerCase(),
      password,
      options: {
        // Fixed: Point to the correct verification endpoint
        emailRedirectTo: `${url.origin}/auth/verify`,
        data: {
          first_name: firstName,
          last_name: lastName,
          role: userRole
        }
      }
    });
    if (authError) {
      console.error("💥 Supabase Auth error:", authError);
      if (authError.message.includes("User already registered")) {
        return json({
          success: false,
          errors: ["An account with this email already exists"]
        }, { status: 400 });
      }
      return json({
        success: false,
        errors: [`Registration failed: ${authError.message}`]
      }, { status: 500 });
    }
    if (!authData.user) {
      return json({
        success: false,
        errors: ["Failed to create user account"]
      }, { status: 500 });
    }
    console.log("✅ Supabase Auth user created:", authData.user.id);
    console.log("💾 Inserting user profile data...");
    const { error: insertError } = await supabase.from("user_profiles").insert([
      {
        id: authData.user.id,
        // Use the auth user's ID
        email: email.toLowerCase(),
        first_name: firstName,
        last_name: lastName,
        role: userRole
      }
    ]);
    if (insertError) {
      console.error("💥 Profile insert error:", insertError);
      try {
        await supabase.auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        console.error("Failed to cleanup auth user:", cleanupError);
      }
      return json({
        success: false,
        errors: [`Profile creation failed: ${insertError.message}`]
      }, { status: 500 });
    }
    console.log("✅ User profile created successfully");
    if (authData.user && !authData.session) {
      return json({
        success: true,
        message: "Registration successful! Please check your email to verify your account before logging in.",
        requiresEmailConfirmation: true
      });
    } else {
      return json({
        success: true,
        message: "Registration successful! You can now log in.",
        requiresEmailConfirmation: false
      });
    }
  } catch (error) {
    console.error("💥 Unexpected registration error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return json({
      success: false,
      errors: ["An unexpected error occurred: " + errorMessage]
    }, { status: 500 });
  }
}
export {
  POST
};
