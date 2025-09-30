// src/routes/api/validate-team-code/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { TEAM_ADVANCE, TEAM_MARKETING, TEAM_PRODUCTION, TEAM_BOOKING } from '$env/static/private';
import { supabase } from '$lib/supabase.js';

// Helper function to remove quotes from environment variables if they exist
function cleanTeamCode(code: string): string {
	return code.replace(/^['"]|['"]$/g, '');
}

// Helper function to capitalize first letter
function capitalizeFirstLetter(string: string): string {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

const VALID_TEAM_CODES = [
	cleanTeamCode(TEAM_ADVANCE),
	cleanTeamCode(TEAM_MARKETING), 
	cleanTeamCode(TEAM_PRODUCTION),
	cleanTeamCode(TEAM_BOOKING)
];

export async function POST({ request }: RequestEvent) {
	console.log('🔍 Team code validation called');
	
	try {
		const body = await request.json();
		console.log('📝 Team validation request:', { 
			code: body.code ? 'provided' : 'missing',
			userId: body.userId ? 'provided' : 'missing'
		});
		
		const { code, userId } = body;
		
		// Validate inputs
		if (!code || typeof code !== 'string') {
			console.log('❌ Invalid team code format');
			return json({
				isValid: false,
				message: 'Invalid team code format'
			}, { status: 400 });
		}

		if (!userId || typeof userId !== 'string') {
			console.log('❌ User ID missing');
			return json({
				isValid: false,
				message: 'User ID is required'
			}, { status: 400 });
		}
		
		// Validate team code
		const isValid = VALID_TEAM_CODES.includes(code.trim());
		console.log('✅ Team code validation result:', { code: code.trim(), isValid });
		
		if (!isValid) {
			return json({
				isValid: false,
				message: 'Invalid team code'
			}, { status: 400 });
		}

		// Determine team name
		let teamName: string | null = null;
		switch (code.trim()) {
			case cleanTeamCode(TEAM_ADVANCE):
				teamName = 'advance';
				break;
			case cleanTeamCode(TEAM_MARKETING):
				teamName = 'marketing';
				break;
			case cleanTeamCode(TEAM_PRODUCTION):
				teamName = 'production';
				break;
			case cleanTeamCode(TEAM_BOOKING):
				teamName = 'booking';
				break;
		}

		if (!teamName) {
			return json({
				isValid: false,
				message: 'Unable to determine team name'
			}, { status: 400 });
		}

		const capitalizedTeamName = capitalizeFirstLetter(teamName);

		// Fetch user profile with better error handling
		const { data: userProfile, error: fetchError } = await supabase
			.from('user_profiles')
			.select('id, main_permission, secondary_permission')
			.eq('id', userId)
			.single();

		if (fetchError) {
			console.error('❌ Error fetching user profile:', fetchError);
			
			// Check if it's a "not found" error vs actual server error
			if (fetchError.code === 'PGRST116') {
				return json({
					isValid: false,
					message: 'User profile not found'
				}, { status: 404 });
			}
			
			return json({
				isValid: false,
				message: 'Error fetching user profile'
			}, { status: 500 });
		}

		if (!userProfile) {
			console.log('❌ User profile not found');
			return json({
				isValid: false,
				message: 'User profile not found'
			}, { status: 404 });
		}

		// Check if user already has this team permission
		const currentMainPermission = userProfile.main_permission;
		const currentSecondaryPermission = userProfile.secondary_permission;

		// Handle secondary_permission as array or string
		let secondaryPermissions: string[] = [];
		if (currentSecondaryPermission) {
			if (Array.isArray(currentSecondaryPermission)) {
				secondaryPermissions = currentSecondaryPermission;
			} else if (typeof currentSecondaryPermission === 'string') {
				secondaryPermissions = currentSecondaryPermission.includes(',') 
					? currentSecondaryPermission.split(',').map(p => p.trim())
					: [currentSecondaryPermission];
			}
		}

		// Check if user already has this specific team permission
		if (currentMainPermission === capitalizedTeamName || secondaryPermissions.includes(capitalizedTeamName)) {
			console.log('⚠️ User already has this team permission:', capitalizedTeamName);
			return json({
				isValid: true,
				alreadyJoined: true,
				message: `You've already joined the ${capitalizedTeamName} team`
			});
		}

		// Determine where to add the team permission
		let updateData: { main_permission?: string; secondary_permission?: string } = {};

		if (!currentMainPermission || currentMainPermission === '') {
			updateData.main_permission = capitalizedTeamName;
			console.log('📝 Adding team to main_permission:', capitalizedTeamName);
		} else {
			const newSecondaryPermissions = [...secondaryPermissions, capitalizedTeamName];
			// ✨ FIX: Join the array into a comma-separated string before updating
			updateData.secondary_permission = newSecondaryPermissions.join(', ');
			console.log('📝 Adding team to secondary_permission string:', updateData.secondary_permission);
		}

		// Update user profile
		const { error: updateError } = await supabase
			.from('user_profiles')
			.update(updateData)
			.eq('id', userId);

		if (updateError) {
			console.error('❌ Error updating user profile:', updateError);
			return json({
				isValid: false,
				message: 'Error updating user profile'
			}, { status: 500 });
		}

		console.log('✅ Successfully updated user permissions');
		
		return json({
			isValid: true,
			teamName: capitalizedTeamName,
			message: `Successfully joined the ${capitalizedTeamName} team!`,
			permissionAdded: Object.keys(updateData)[0]
		});
		
	} catch (error) {
		console.error('💥 Team code validation error:', error);
		return json({
			isValid: false,
			message: 'Internal server error'
		}, { status: 500 });
	}
}