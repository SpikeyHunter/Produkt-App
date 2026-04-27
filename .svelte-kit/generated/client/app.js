export { matchers } from './matchers.js';

export const nodes = [
	() => import('./nodes/0'),
	() => import('./nodes/1'),
	() => import('./nodes/2'),
	() => import('./nodes/3'),
	() => import('./nodes/4'),
	() => import('./nodes/5'),
	() => import('./nodes/6'),
	() => import('./nodes/7'),
	() => import('./nodes/8'),
	() => import('./nodes/9'),
	() => import('./nodes/10'),
	() => import('./nodes/11'),
	() => import('./nodes/12'),
	() => import('./nodes/13'),
	() => import('./nodes/14'),
	() => import('./nodes/15'),
	() => import('./nodes/16'),
	() => import('./nodes/17'),
	() => import('./nodes/18'),
	() => import('./nodes/19'),
	() => import('./nodes/20'),
	() => import('./nodes/21'),
	() => import('./nodes/22'),
	() => import('./nodes/23'),
	() => import('./nodes/24'),
	() => import('./nodes/25'),
	() => import('./nodes/26'),
	() => import('./nodes/27'),
	() => import('./nodes/28'),
	() => import('./nodes/29'),
	() => import('./nodes/30'),
	() => import('./nodes/31'),
	() => import('./nodes/32'),
	() => import('./nodes/33'),
	() => import('./nodes/34'),
	() => import('./nodes/35'),
	() => import('./nodes/36'),
	() => import('./nodes/37'),
	() => import('./nodes/38'),
	() => import('./nodes/39'),
	() => import('./nodes/40'),
	() => import('./nodes/41'),
	() => import('./nodes/42'),
	() => import('./nodes/43')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/advancing/artistliaison": [3],
		"/advancing/gathered": [4],
		"/advancing/gathered/[event_param]": [5],
		"/advancing/hoteltracker": [6],
		"/advancing/localartists": [7],
		"/advancing/merchsettlement": [8],
		"/auth/verify": [9],
		"/bazart": [10],
		"/booking/artistavailability": [11],
		"/booking/contracts": [12],
		"/booking/dailycount": [13],
		"/booking/talentpayments": [14],
		"/boxoffice": [15],
		"/calendar": [~16],
		"/calendar/unsubscribe": [18],
		"/calendar/[id]/[[tab]]": [17],
		"/dashboard": [19],
		"/letter": [20],
		"/login/forgot-password": [21],
		"/login/register": [22],
		"/login/reset-confirmed": [23],
		"/login/reset-password": [24],
		"/marketing/comparehub": [25],
		"/marketing/comptickets": [26],
		"/marketing/customers": [27],
		"/marketing/eventsinfo": [28],
		"/ncgapp/controlcenter": [29],
		"/production/backline": [~30],
		"/production/emailtech": [31],
		"/production/showbudget": [32],
		"/production/techrider": [33],
		"/public/invoice/[token]": [34],
		"/schedules/stagemanager": [35],
		"/schedules/tech": [36],
		"/settimes": [37],
		"/settings": [38],
		"/sultanshepard/djshow": [39],
		"/sultanshepard/djshow/[id]": [40],
		"/sultanshepard/tour": [41],
		"/wifi/corpo": [42],
		"/wifi/ncg": [43]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));
export const encoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.encode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';