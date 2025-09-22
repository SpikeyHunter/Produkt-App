import { json } from "@sveltejs/kit";
import { createClient } from "@supabase/supabase-js";
import { S as SUPABASE_SERVICE_ROLE_KEY } from "../../../../chunks/private.js";
import { P as PUBLIC_SUPABASE_URL } from "../../../../chunks/public.js";
const supabaseAdmin = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
async function verifyAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.substring(7);
  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      console.error("❌ Auth verification failed:", authError?.message);
      return null;
    }
    console.log("✅ Auth verified for user:", user.id);
    return user;
  } catch (err) {
    console.error("❌ Auth verification error:", err);
    return null;
  }
}
const POST = async ({ request }) => {
  try {
    console.log("📤 Upload API called");
    const authHeader = request.headers.get("authorization");
    const user = await verifyAuth(authHeader);
    if (!user) {
      console.error("❌ Unauthorized upload attempt");
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("✅ User authenticated:", user.id);
    const formData = await request.formData();
    const file = formData.get("file");
    const filePath = formData.get("filePath");
    const bucket = formData.get("bucket") || "documents";
    const eventId = formData.get("eventId");
    const artistName = formData.get("artistName");
    if (!file || !filePath) {
      return json({ error: "Missing file or file path" }, { status: 400 });
    }
    console.log("📁 Upload details:", {
      fileName: file.name,
      fileSize: file.size,
      filePath,
      bucket,
      eventId,
      artistName
    });
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return json({ error: "File too large. Maximum size is 10MB." }, { status: 413 });
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      return json({ error: "Invalid file type. Only PDF and image files are allowed." }, { status: 400 });
    }
    const fileBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileBuffer);
    console.log("📤 Uploading to Supabase storage...");
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(filePath, uint8Array, {
      contentType: file.type,
      upsert: true,
      // Replace existing file if it exists
      cacheControl: "3600"
    });
    if (uploadError) {
      console.error("❌ Storage upload error:", uploadError);
      return json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }
    console.log("✅ File uploaded to storage:", uploadData.path);
    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(filePath);
    if (!urlData?.publicUrl) {
      console.error("❌ Failed to get public URL");
      return json({ error: "Failed to get file URL" }, { status: 500 });
    }
    console.log("✅ Public URL generated:", urlData.publicUrl);
    return json({
      success: true,
      publicUrl: urlData.publicUrl,
      path: uploadData.path,
      fileName: file.name
    });
  } catch (err) {
    console.error("❌ Upload API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Upload failed";
    return json({ error: errorMessage }, { status: 500 });
  }
};
const DELETE = async ({ request }) => {
  try {
    console.log("🗑️ Delete API called");
    const authHeader = request.headers.get("authorization");
    const user = await verifyAuth(authHeader);
    if (!user) {
      console.error("❌ Unauthorized delete attempt");
      return json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("✅ User authenticated for delete:", user.id);
    const { fileUrl, bucket = "documents" } = await request.json();
    if (!fileUrl) {
      return json({ error: "Missing file URL" }, { status: 400 });
    }
    console.log("🗑️ Delete request:", { fileUrl, bucket });
    let filePath;
    try {
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split("/");
      const objectIndex = pathParts.findIndex((part) => part === "object");
      const publicIndex = pathParts.findIndex((part) => part === "public");
      const bucketIndex = pathParts.findIndex((part) => part === bucket);
      if (objectIndex === -1 || publicIndex === -1 || bucketIndex === -1) {
        throw new Error("Invalid Supabase storage URL format");
      }
      const encodedPath = pathParts.slice(bucketIndex + 1).join("/");
      filePath = decodeURIComponent(encodedPath);
      console.log("📁 Extracted and decoded file path:", filePath);
      console.log("📁 Original encoded path:", encodedPath);
    } catch (err) {
      console.error("❌ Error parsing file URL:", err);
      return json({ error: "Invalid file URL" }, { status: 400 });
    }
    const { error: deleteError } = await supabaseAdmin.storage.from(bucket).remove([filePath]);
    if (deleteError) {
      console.error("❌ Storage delete error:", deleteError);
      return json({ error: `Delete failed: ${deleteError.message}` }, { status: 500 });
    }
    console.log("✅ File deleted from storage:", filePath);
    return json({
      success: true,
      message: "File deleted successfully"
    });
  } catch (err) {
    console.error("❌ Delete API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Delete failed";
    return json({ error: errorMessage }, { status: 500 });
  }
};
export {
  DELETE,
  POST
};
