// src/routes/api/passport-ocr/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { env } from '$env/dynamic/private';
import { 
  parsePassportText, 
  getGoogleCredentials,
  type DetectedPassportInfo,
  type NameHints 
} from '$lib/utils/passport/ocrUtils';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw error(401, 'Unauthorized');
    }

    const { imageUrl, nameHints } = await request.json();
    
    if (!imageUrl) {
      throw error(400, 'Image URL is required');
    }

    console.log('🔍 Starting Google Vision OCR...');
    
    // Initialize Google Cloud Vision client
    const credentials = getGoogleCredentials(env.GOOGLE_CREDENTIALS);
    if (!credentials) {
      throw error(500, 'Google Cloud credentials not configured');
    }

    const client = new ImageAnnotatorClient({
      credentials,
      projectId: credentials.project_id
    });

    let imageInput: any;

    // Handle different image formats
    if (imageUrl.startsWith('data:image/')) {
      // Base64 image - extract just the base64 data
      console.log('📷 Processing base64 image...');
      const base64Data = imageUrl.split(',')[1];
      
      if (!base64Data) {
        throw error(400, 'Invalid base64 image format');
      }
      
      imageInput = {
        image: {
          content: base64Data
        }
      };
    } else if (imageUrl.startsWith('http')) {
      // URL image
      console.log('📷 Processing image URL...');
      imageInput = {
        image: {
          source: { imageUri: imageUrl }
        }
      };
    } else if (imageUrl.startsWith('blob:')) {
      throw error(400, 'Blob URLs not supported. Please upload the image first.');
    } else {
      throw error(400, 'Invalid image format');
    }

    // Perform text detection with error handling
    console.log('🔍 Calling Google Vision API...');
    
    let result;
    try {
      const response = await client.textDetection(imageInput);
      result = response[0];
    } catch (apiError: any) {
      console.error('❌ Google Vision API error:', apiError);
      
      if (apiError.message?.includes('Invalid image content')) {
        throw error(400, 'Invalid image format. Please use JPEG, PNG, or PDF format.');
      }
      if (apiError.message?.includes('Image too large')) {
        throw error(413, 'Image file is too large. Please use a smaller image (max 20MB).');
      }
      if (apiError.code === 7) { // PERMISSION_DENIED
        throw error(500, 'Google Cloud Vision API access denied. Please check credentials.');
      }
      
      throw error(500, `Vision API error: ${apiError.message || 'Unknown error'}`);
    }
    
    if (result.error) {
      console.error('❌ Google Vision API error:', result.error);
      throw error(500, `Vision API error: ${result.error.message}`);
    }

    const detections = result.textAnnotations;
    
    if (!detections || detections.length === 0) {
      console.log('❌ No text found in image');
      return json({
        success: false,
        detectedInfo: {},
        message: 'No text could be detected in the image. Please ensure the passport image is clear and try again.'
      });
    }

    // Get the full text (first annotation contains all text)
    const fullText = detections[0].description || '';
    console.log('📄 Detected text length:', fullText.length);

    // Parse the detected text
    const detectedInfo = parsePassportText(fullText, nameHints);
    
    console.log('✅ Parsed passport data:', detectedInfo);

    return json({
      success: true,
      detectedInfo,
      rawText: fullText.substring(0, 500) + (fullText.length > 500 ? '...' : '') // Truncate for logging
    });

  } catch (err) {
    console.error('❌ Passport OCR error:', err);
    
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    
    throw error(500, 'Failed to process passport image. Please try again.');
  }
};