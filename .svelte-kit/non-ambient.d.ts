
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/advancing" | "/advancing/gathered" | "/advancing/gathered/[event_param]" | "/api" | "/api/flight-lookup" | "/api/guests" | "/api/passport-ocr" | "/api/register" | "/api/sync-calendar" | "/api/upload" | "/api/validate-registration-code" | "/api/validate-team-code" | "/auth" | "/auth/callback" | "/auth/forgot-password" | "/auth/reset-password" | "/auth/verify" | "/booking" | "/booking/settimes" | "/calendar" | "/dashboard" | "/letter" | "/login" | "/login/forgot-password" | "/login/register" | "/login/reset-confirmed" | "/login/reset-password" | "/marketing" | "/marketing/eventsinfo" | "/production" | "/settings" | "/wifi";
		RouteParams(): {
			"/advancing/gathered/[event_param]": { event_param: string }
		};
		LayoutParams(): {
			"/": { event_param?: string };
			"/advancing": { event_param?: string };
			"/advancing/gathered": { event_param?: string };
			"/advancing/gathered/[event_param]": { event_param: string };
			"/api": Record<string, never>;
			"/api/flight-lookup": Record<string, never>;
			"/api/guests": Record<string, never>;
			"/api/passport-ocr": Record<string, never>;
			"/api/register": Record<string, never>;
			"/api/sync-calendar": Record<string, never>;
			"/api/upload": Record<string, never>;
			"/api/validate-registration-code": Record<string, never>;
			"/api/validate-team-code": Record<string, never>;
			"/auth": Record<string, never>;
			"/auth/callback": Record<string, never>;
			"/auth/forgot-password": Record<string, never>;
			"/auth/reset-password": Record<string, never>;
			"/auth/verify": Record<string, never>;
			"/booking": Record<string, never>;
			"/booking/settimes": Record<string, never>;
			"/calendar": Record<string, never>;
			"/dashboard": Record<string, never>;
			"/letter": Record<string, never>;
			"/login": Record<string, never>;
			"/login/forgot-password": Record<string, never>;
			"/login/register": Record<string, never>;
			"/login/reset-confirmed": Record<string, never>;
			"/login/reset-password": Record<string, never>;
			"/marketing": Record<string, never>;
			"/marketing/eventsinfo": Record<string, never>;
			"/production": Record<string, never>;
			"/settings": Record<string, never>;
			"/wifi": Record<string, never>
		};
		Pathname(): "/" | "/advancing" | "/advancing/" | "/advancing/gathered" | "/advancing/gathered/" | `/advancing/gathered/${string}` & {} | `/advancing/gathered/${string}/` & {} | "/api" | "/api/" | "/api/flight-lookup" | "/api/flight-lookup/" | "/api/guests" | "/api/guests/" | "/api/passport-ocr" | "/api/passport-ocr/" | "/api/register" | "/api/register/" | "/api/sync-calendar" | "/api/sync-calendar/" | "/api/upload" | "/api/upload/" | "/api/validate-registration-code" | "/api/validate-registration-code/" | "/api/validate-team-code" | "/api/validate-team-code/" | "/auth" | "/auth/" | "/auth/callback" | "/auth/callback/" | "/auth/forgot-password" | "/auth/forgot-password/" | "/auth/reset-password" | "/auth/reset-password/" | "/auth/verify" | "/auth/verify/" | "/booking" | "/booking/" | "/booking/settimes" | "/booking/settimes/" | "/calendar" | "/calendar/" | "/dashboard" | "/dashboard/" | "/letter" | "/letter/" | "/login" | "/login/" | "/login/forgot-password" | "/login/forgot-password/" | "/login/register" | "/login/register/" | "/login/reset-confirmed" | "/login/reset-confirmed/" | "/login/reset-password" | "/login/reset-password/" | "/marketing" | "/marketing/" | "/marketing/eventsinfo" | "/marketing/eventsinfo/" | "/production" | "/production/" | "/settings" | "/settings/" | "/wifi" | "/wifi/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/.DS_Store" | "/favicon.svg" | "/images/NCG_LOGO2_BLANC.png" | "/images/ProduktXX_LOGO1.png" | "/images/ProduktXX_LOGO2.png" | "/pdf/.DS_Store" | "/pdf/IMM5686E_Template_Empty.pdf" | "/pdf/Invitation Letter.pdf" | string & {};
	}
}