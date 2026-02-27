
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
		RouteId(): "/" | "/advancing" | "/advancing/artistliaison" | "/advancing/gathered" | "/advancing/gathered/[event_param]" | "/advancing/hoteltracker" | "/advancing/localartists" | "/advancing/merchsettlement" | "/api" | "/api/booking" | "/api/booking/evenko" | "/api/booking/evenko/cancel" | "/api/booking/igloofest" | "/api/booking/igloofest/cancel" | "/api/booking/piknic" | "/api/booking/piknic/cancel" | "/api/bug-report" | "/api/calendar-confirm-email" | "/api/calendar-confirm-sms" | "/api/calendar-invite-mail" | "/api/calendar-invite-phone" | "/api/calendar" | "/api/download-tech-rider" | "/api/flight-lookup" | "/api/generate-advance-pdf" | "/api/generate-liaison-pdf" | "/api/generate-merch-pdf" | "/api/generate-settimes-pdf" | "/api/google-calendar" | "/api/guests" | "/api/latest-commit" | "/api/passport-ocr" | "/api/register" | "/api/sync-drive-rider" | "/api/update-event" | "/api/upload" | "/api/validate-registration-code" | "/api/validate-team-code" | "/api/webhooks" | "/api/webhooks/sns-inbound" | "/auth" | "/auth/callback" | "/auth/forgot-password" | "/auth/reset-password" | "/auth/verify" | "/booking" | "/booking/artistavailability" | "/booking/talentpayments" | "/calendar" | "/calendar/unsubscribe" | "/calendar/[id]" | "/dashboard" | "/letter" | "/login" | "/login/forgot-password" | "/login/register" | "/login/reset-confirmed" | "/login/reset-password" | "/marketing" | "/marketing/comparehub" | "/marketing/comptickets" | "/marketing/customers" | "/marketing/eventsinfo" | "/ncgapp" | "/ncgapp/controlcenter" | "/production" | "/production/backline" | "/production/emailtech" | "/production/showbudget" | "/production/techrider" | "/public" | "/public/invoice" | "/public/invoice/[token]" | "/schedules" | "/schedules/stagemanager" | "/schedules/tech" | "/settimes" | "/settings" | "/sultanshepard" | "/sultanshepard/djshow" | "/sultanshepard/djshow/[id]" | "/wifi" | "/wifi/corpo" | "/wifi/ncg";
		RouteParams(): {
			"/advancing/gathered/[event_param]": { event_param: string };
			"/calendar/[id]": { id: string };
			"/public/invoice/[token]": { token: string };
			"/sultanshepard/djshow/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { event_param?: string; id?: string; token?: string };
			"/advancing": { event_param?: string };
			"/advancing/artistliaison": Record<string, never>;
			"/advancing/gathered": { event_param?: string };
			"/advancing/gathered/[event_param]": { event_param: string };
			"/advancing/hoteltracker": Record<string, never>;
			"/advancing/localartists": Record<string, never>;
			"/advancing/merchsettlement": Record<string, never>;
			"/api": Record<string, never>;
			"/api/booking": Record<string, never>;
			"/api/booking/evenko": Record<string, never>;
			"/api/booking/evenko/cancel": Record<string, never>;
			"/api/booking/igloofest": Record<string, never>;
			"/api/booking/igloofest/cancel": Record<string, never>;
			"/api/booking/piknic": Record<string, never>;
			"/api/booking/piknic/cancel": Record<string, never>;
			"/api/bug-report": Record<string, never>;
			"/api/calendar-confirm-email": Record<string, never>;
			"/api/calendar-confirm-sms": Record<string, never>;
			"/api/calendar-invite-mail": Record<string, never>;
			"/api/calendar-invite-phone": Record<string, never>;
			"/api/calendar": Record<string, never>;
			"/api/download-tech-rider": Record<string, never>;
			"/api/flight-lookup": Record<string, never>;
			"/api/generate-advance-pdf": Record<string, never>;
			"/api/generate-liaison-pdf": Record<string, never>;
			"/api/generate-merch-pdf": Record<string, never>;
			"/api/generate-settimes-pdf": Record<string, never>;
			"/api/google-calendar": Record<string, never>;
			"/api/guests": Record<string, never>;
			"/api/latest-commit": Record<string, never>;
			"/api/passport-ocr": Record<string, never>;
			"/api/register": Record<string, never>;
			"/api/sync-drive-rider": Record<string, never>;
			"/api/update-event": Record<string, never>;
			"/api/upload": Record<string, never>;
			"/api/validate-registration-code": Record<string, never>;
			"/api/validate-team-code": Record<string, never>;
			"/api/webhooks": Record<string, never>;
			"/api/webhooks/sns-inbound": Record<string, never>;
			"/auth": Record<string, never>;
			"/auth/callback": Record<string, never>;
			"/auth/forgot-password": Record<string, never>;
			"/auth/reset-password": Record<string, never>;
			"/auth/verify": Record<string, never>;
			"/booking": Record<string, never>;
			"/booking/artistavailability": Record<string, never>;
			"/booking/talentpayments": Record<string, never>;
			"/calendar": { id?: string };
			"/calendar/unsubscribe": Record<string, never>;
			"/calendar/[id]": { id: string };
			"/dashboard": Record<string, never>;
			"/letter": Record<string, never>;
			"/login": Record<string, never>;
			"/login/forgot-password": Record<string, never>;
			"/login/register": Record<string, never>;
			"/login/reset-confirmed": Record<string, never>;
			"/login/reset-password": Record<string, never>;
			"/marketing": Record<string, never>;
			"/marketing/comparehub": Record<string, never>;
			"/marketing/comptickets": Record<string, never>;
			"/marketing/customers": Record<string, never>;
			"/marketing/eventsinfo": Record<string, never>;
			"/ncgapp": Record<string, never>;
			"/ncgapp/controlcenter": Record<string, never>;
			"/production": Record<string, never>;
			"/production/backline": Record<string, never>;
			"/production/emailtech": Record<string, never>;
			"/production/showbudget": Record<string, never>;
			"/production/techrider": Record<string, never>;
			"/public": { token?: string };
			"/public/invoice": { token?: string };
			"/public/invoice/[token]": { token: string };
			"/schedules": Record<string, never>;
			"/schedules/stagemanager": Record<string, never>;
			"/schedules/tech": Record<string, never>;
			"/settimes": Record<string, never>;
			"/settings": Record<string, never>;
			"/sultanshepard": { id?: string };
			"/sultanshepard/djshow": { id?: string };
			"/sultanshepard/djshow/[id]": { id: string };
			"/wifi": Record<string, never>;
			"/wifi/corpo": Record<string, never>;
			"/wifi/ncg": Record<string, never>
		};
		Pathname(): "/" | "/advancing" | "/advancing/" | "/advancing/artistliaison" | "/advancing/artistliaison/" | "/advancing/gathered" | "/advancing/gathered/" | `/advancing/gathered/${string}` & {} | `/advancing/gathered/${string}/` & {} | "/advancing/hoteltracker" | "/advancing/hoteltracker/" | "/advancing/localartists" | "/advancing/localartists/" | "/advancing/merchsettlement" | "/advancing/merchsettlement/" | "/api" | "/api/" | "/api/booking" | "/api/booking/" | "/api/booking/evenko" | "/api/booking/evenko/" | "/api/booking/evenko/cancel" | "/api/booking/evenko/cancel/" | "/api/booking/igloofest" | "/api/booking/igloofest/" | "/api/booking/igloofest/cancel" | "/api/booking/igloofest/cancel/" | "/api/booking/piknic" | "/api/booking/piknic/" | "/api/booking/piknic/cancel" | "/api/booking/piknic/cancel/" | "/api/bug-report" | "/api/bug-report/" | "/api/calendar-confirm-email" | "/api/calendar-confirm-email/" | "/api/calendar-confirm-sms" | "/api/calendar-confirm-sms/" | "/api/calendar-invite-mail" | "/api/calendar-invite-mail/" | "/api/calendar-invite-phone" | "/api/calendar-invite-phone/" | "/api/calendar" | "/api/calendar/" | "/api/download-tech-rider" | "/api/download-tech-rider/" | "/api/flight-lookup" | "/api/flight-lookup/" | "/api/generate-advance-pdf" | "/api/generate-advance-pdf/" | "/api/generate-liaison-pdf" | "/api/generate-liaison-pdf/" | "/api/generate-merch-pdf" | "/api/generate-merch-pdf/" | "/api/generate-settimes-pdf" | "/api/generate-settimes-pdf/" | "/api/google-calendar" | "/api/google-calendar/" | "/api/guests" | "/api/guests/" | "/api/latest-commit" | "/api/latest-commit/" | "/api/passport-ocr" | "/api/passport-ocr/" | "/api/register" | "/api/register/" | "/api/sync-drive-rider" | "/api/sync-drive-rider/" | "/api/update-event" | "/api/update-event/" | "/api/upload" | "/api/upload/" | "/api/validate-registration-code" | "/api/validate-registration-code/" | "/api/validate-team-code" | "/api/validate-team-code/" | "/api/webhooks" | "/api/webhooks/" | "/api/webhooks/sns-inbound" | "/api/webhooks/sns-inbound/" | "/auth" | "/auth/" | "/auth/callback" | "/auth/callback/" | "/auth/forgot-password" | "/auth/forgot-password/" | "/auth/reset-password" | "/auth/reset-password/" | "/auth/verify" | "/auth/verify/" | "/booking" | "/booking/" | "/booking/artistavailability" | "/booking/artistavailability/" | "/booking/talentpayments" | "/booking/talentpayments/" | "/calendar" | "/calendar/" | "/calendar/unsubscribe" | "/calendar/unsubscribe/" | `/calendar/${string}` & {} | `/calendar/${string}/` & {} | "/dashboard" | "/dashboard/" | "/letter" | "/letter/" | "/login" | "/login/" | "/login/forgot-password" | "/login/forgot-password/" | "/login/register" | "/login/register/" | "/login/reset-confirmed" | "/login/reset-confirmed/" | "/login/reset-password" | "/login/reset-password/" | "/marketing" | "/marketing/" | "/marketing/comparehub" | "/marketing/comparehub/" | "/marketing/comptickets" | "/marketing/comptickets/" | "/marketing/customers" | "/marketing/customers/" | "/marketing/eventsinfo" | "/marketing/eventsinfo/" | "/ncgapp" | "/ncgapp/" | "/ncgapp/controlcenter" | "/ncgapp/controlcenter/" | "/production" | "/production/" | "/production/backline" | "/production/backline/" | "/production/emailtech" | "/production/emailtech/" | "/production/showbudget" | "/production/showbudget/" | "/production/techrider" | "/production/techrider/" | "/public" | "/public/" | "/public/invoice" | "/public/invoice/" | `/public/invoice/${string}` & {} | `/public/invoice/${string}/` & {} | "/schedules" | "/schedules/" | "/schedules/stagemanager" | "/schedules/stagemanager/" | "/schedules/tech" | "/schedules/tech/" | "/settimes" | "/settimes/" | "/settings" | "/settings/" | "/sultanshepard" | "/sultanshepard/" | "/sultanshepard/djshow" | "/sultanshepard/djshow/" | `/sultanshepard/djshow/${string}` & {} | `/sultanshepard/djshow/${string}/` & {} | "/wifi" | "/wifi/" | "/wifi/corpo" | "/wifi/corpo/" | "/wifi/ncg" | "/wifi/ncg/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/.DS_Store" | "/favicon-512.png" | "/fonts/Everett-Regular.otf" | "/images/.DS_Store" | "/images/NCG_House-2.png" | "/images/NCG_House.png" | "/images/NCG_LOGO2_BLANC.png" | "/images/NCG_LOGO3_BLANC.png" | "/images/ProduktXX_LOGO1.png" | "/images/ProduktXX_LOGO2.png" | "/images/ProduktXX_LOGO_lockup.png" | "/manifest.json" | "/pdf/.DS_Store" | "/pdf/IMM5686E_Template_Empty.pdf" | "/pdf/Invitation Letter.pdf" | string & {};
	}
}