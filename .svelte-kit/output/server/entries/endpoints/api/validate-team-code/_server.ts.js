import { json } from "@sveltejs/kit";
import { T as TEAM_BOOKING, a as TEAM_PRODUCTION, b as TEAM_MARKETING, c as TEAM_ADVANCE } from "../../../../chunks/private.js";
import { s as supabase } from "../../../../chunks/supabase.js";
function cleanTeamCode(code) {
  return code.replace(/^['"]|['"]$/g, "");
}
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
const VALID_TEAM_CODES = [
  cleanTeamCode(TEAM_ADVANCE),
  cleanTeamCode(TEAM_MARKETING),
  cleanTeamCode(TEAM_PRODUCTION),
  cleanTeamCode(TEAM_BOOKING)
];
console.log("🔧 DEBUG: Raw environment variables:", {
  TEAM_ADVANCE,
  TEAM_MARKETING,
  TEAM_PRODUCTION,
  TEAM_BOOKING
});
console.log("🔧 DEBUG: Cleaned team codes:", VALID_TEAM_CODES);
async function POST({ request }) {
  console.log("🔍 Team code validation called");
  try {
    const body = await request.json();
    console.log("📝 Team validation request:", {
      code: body.code ? "provided" : "missing",
      userId: body.userId ? "provided" : "missing",
      hasUserId: !!body.userId,
      actualUserId: body.userId
    });
    const { code, userId } = body;
    if (!code || typeof code !== "string") {
      console.log("❌ Invalid team code format");
      return json({
        isValid: false,
        message: "Invalid team code format"
      });
    }
    if (!userId || typeof userId !== "string") {
      console.log("❌ User ID missing");
      return json({
        isValid: false,
        message: "User ID is required"
      });
    }
    const isValid = VALID_TEAM_CODES.includes(code.trim());
    console.log("🔧 DEBUG: Code validation:", {
      inputCode: code.trim(),
      validCodes: VALID_TEAM_CODES,
      isValid
    });
    console.log("✅ Team code validation result:", { code: code.trim(), isValid });
    if (!isValid) {
      return json({
        isValid: false,
        message: "Invalid team code"
      });
    }
    let teamName = null;
    switch (code.trim()) {
      case cleanTeamCode(TEAM_ADVANCE):
        teamName = "advance";
        break;
      case cleanTeamCode(TEAM_MARKETING):
        teamName = "marketing";
        break;
      case cleanTeamCode(TEAM_PRODUCTION):
        teamName = "production";
        break;
      case cleanTeamCode(TEAM_BOOKING):
        teamName = "booking";
        break;
    }
    if (!teamName) {
      return json({
        isValid: false,
        message: "Unable to determine team name"
      });
    }
    const capitalizedTeamName = capitalizeFirstLetter(teamName);
    const { data: userProfile, error: fetchError } = await supabase.from("user_profiles").select("id, main_permission, secondary_permission").eq("id", userId).single();
    if (fetchError) {
      console.error("❌ Error fetching user profile:", fetchError);
      return json({
        isValid: false,
        message: "Error fetching user profile"
      }, { status: 500 });
    }
    if (!userProfile) {
      console.log("❌ User profile not found");
      return json({
        isValid: false,
        message: "User profile not found"
      }, { status: 404 });
    }
    const currentMainPermission = userProfile.main_permission;
    const currentSecondaryPermission = userProfile.secondary_permission;
    let secondaryPermissions = [];
    if (currentSecondaryPermission) {
      if (Array.isArray(currentSecondaryPermission)) {
        secondaryPermissions = currentSecondaryPermission;
      } else if (typeof currentSecondaryPermission === "string") {
        secondaryPermissions = currentSecondaryPermission.includes(",") ? currentSecondaryPermission.split(",").map((p) => p.trim()) : [currentSecondaryPermission];
      }
    }
    if (currentMainPermission === capitalizedTeamName || secondaryPermissions.includes(capitalizedTeamName)) {
      console.log("⚠️ User already has this team permission:", capitalizedTeamName);
      return json({
        isValid: true,
        alreadyJoined: true,
        message: `You've already joined the ${capitalizedTeamName} team`
      });
    }
    let updateData = {};
    if (!currentMainPermission || currentMainPermission === "") {
      updateData.main_permission = capitalizedTeamName;
      console.log("📝 Adding team to main_permission:", capitalizedTeamName);
    } else {
      const newSecondaryPermissions = [...secondaryPermissions, capitalizedTeamName];
      updateData.secondary_permission = newSecondaryPermissions;
      console.log("📝 Adding team to secondary_permission array:", newSecondaryPermissions);
    }
    const { error: updateError } = await supabase.from("user_profiles").update(updateData).eq("id", userId);
    if (updateError) {
      console.error("❌ Error updating user profile:", updateError);
      return json({
        isValid: false,
        message: "Error updating user profile"
      }, { status: 500 });
    }
    console.log("✅ Successfully updated user permissions");
    return json({
      isValid: true,
      teamName: capitalizedTeamName,
      message: `Successfully joined the ${capitalizedTeamName} team!`,
      permissionAdded: Object.keys(updateData)[0]
      // 'main_permission' or 'secondary_permission'
    });
  } catch (error) {
    console.error("💥 Team code validation error:", error);
    return json({
      isValid: false,
      message: "Internal server error"
    }, { status: 500 });
  }
}
export {
  POST
};
