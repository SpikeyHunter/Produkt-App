// src/routes/api/validate-registration-code/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { ADMIN_REGISTRATION_CODE, USER_REGISTRATION_CODE } from '$env/static/private';

const VALID_CODES = [ADMIN_REGISTRATION_CODE, USER_REGISTRATION_CODE];

export async function POST({ request }: RequestEvent) {
  console.log('🔍 Registration code validation called');
  
  try {
    const body = await request.json();
    console.log('📝 Validation request:', { code: body.code ? 'provided' : 'missing' });
    
    const { code } = body;
    
    if (!code || typeof code !== 'string') {
      console.log('❌ Invalid code format');
      return json({ 
        isValid: false 
      });
    }
    
    const isValid = VALID_CODES.includes(code.trim());
    console.log('✅ Code validation result:', { code: code.trim(), isValid });
    
    return json({ 
      isValid 
    });
    
  } catch (error) {
    console.error('💥 Registration code validation error:', error);
    return json({ 
      isValid: false 
    }, { status: 500 });
  }
}