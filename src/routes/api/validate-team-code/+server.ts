import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { TEAM_ADVANCE, TEAM_MARKETING, TEAM_PRODUCTION, TEAM_BOOKING } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabaseAdmin.js';

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
	try {
		const body = await request.json();
		const { code, userId } = body;

		// Validate inputs
		if (!code || typeof code !== 'string' || !userId || typeof userId !== 'string') {
			return json({ isValid: false, message: 'Invalid team code or user ID format' }, { status: 400 });
		}

		// Validate team code
		const isValid = VALID_TEAM_CODES.includes(code.trim());
		if (!isValid) {
			return json({ isValid: false, message: 'Invalid team code' }, { status: 400 });
		}

		// Determine team name
		let teamName: string | null = null;
		switch (code.trim()) {
			case cleanTeamCode(TEAM_ADVANCE): teamName = 'advance'; break;
			case cleanTeamCode(TEAM_MARKETING): teamName = 'marketing'; break;
			case cleanTeamCode(TEAM_PRODUCTION): teamName = 'production'; break;
			case cleanTeamCode(TEAM_BOOKING): teamName = 'booking'; break;
		}

		if (!teamName) {
			return json({ isValid: false, message: 'Unable to determine team name' }, { status: 400 });
		}

		const capitalizedTeamName = capitalizeFirstLetter(teamName);

		// Use the ADMIN client to fetch user profile
		const { data: userProfile, error: fetchError } = await supabaseAdmin
			.from('user_profiles')
			.select('id, main_permission, secondary_permission')
			.eq('id', userId)
			.single();

		if (fetchError) {
			console.error('❌ Error fetching user profile:', fetchError);
			if (fetchError.code === 'PGRST116') {
				return json({ isValid: false, message: 'User profile not found' }, { status: 404 });
			}
			return json({ isValid: false, message: 'Error fetching user profile' }, { status: 500 });
		}

		// Check if user already has this team permission
		const currentMainPermission = userProfile.main_permission;
		const secondaryPermissions: string[] = userProfile.secondary_permission || [];

		if (currentMainPermission === capitalizedTeamName || secondaryPermissions.includes(capitalizedTeamName)) {
			return json({
				isValid: true,
				alreadyJoined: true,
				message: `You've already joined the ${capitalizedTeamName} team`
			});
		}

		// Define the shape of the data to be updated
		let updateData: { main_permission?: string; secondary_permission?: string[] } = {};

		if (!currentMainPermission || currentMainPermission === '') {
			updateData.main_permission = capitalizedTeamName;
		} else {
			const newSecondaryPermissions = [...secondaryPermissions, capitalizedTeamName];
			// Assign the JavaScript array directly to the update object
			updateData.secondary_permission = newSecondaryPermissions;
		}

		// Use the ADMIN client to update user profile
		const { error: updateError } = await supabaseAdmin
			.from('user_profiles')
			.update(updateData)
			.eq('id', userId);

		if (updateError) {
			console.error('❌ Error updating user profile:', updateError);
			return json({ isValid: false, message: 'Error updating user profile' }, { status: 500 });
		}

		return json({
			isValid: true,
			teamName: capitalizedTeamName,
			message: `Successfully joined the ${capitalizedTeamName} team!`,
		});

	} catch (error) {
		console.error('💥 Team code validation error:', error);
		return json({ isValid: false, message: 'Internal server error' }, { status: 500 });
	}
}