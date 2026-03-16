export function hasPermission(requiredPermission: string | string[] | undefined, profile: any): boolean {
	// If no specific permission defined, allow access
	if (!requiredPermission || (Array.isArray(requiredPermission) && requiredPermission.length === 0)) {
		return true;
	}
	
	if (!profile) return false;
	if (profile.role === 'Admin') return true;

	// Consolidate permissions
	const mainPerm = profile.main_permission ? [profile.main_permission] : [];
	const secondaryPerms = Array.isArray(profile.secondary_permission)
		? profile.secondary_permission
		: [];
	const pagePerms = Array.isArray(profile.page_permissions) ? profile.page_permissions : [];

	const userPermissions = [...mainPerm, ...secondaryPerms, ...pagePerms].filter(Boolean);

	if (Array.isArray(requiredPermission)) {
		return requiredPermission.some((perm) => userPermissions.includes(perm));
	} else {
		return userPermissions.includes(requiredPermission);
	}
}