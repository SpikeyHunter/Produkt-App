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
	() => import('./nodes/42')
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
		"/booking/dailycount": [12],
		"/booking/talentpayments": [13],
		"/boxoffice": [14],
		"/calendar": [~15],
		"/calendar/unsubscribe": [17],
		"/calendar/[id]/[[tab]]": [16],
		"/dashboard": [18],
		"/letter": [19],
		"/login/forgot-password": [20],
		"/login/register": [21],
		"/login/reset-confirmed": [22],
		"/login/reset-password": [23],
		"/marketing/comparehub": [24],
		"/marketing/comptickets": [25],
		"/marketing/customers": [26],
		"/marketing/eventsinfo": [27],
		"/ncgapp/controlcenter": [28],
		"/production/backline": [~29],
		"/production/emailtech": [30],
		"/production/showbudget": [31],
		"/production/techrider": [32],
		"/public/invoice/[token]": [33],
		"/schedules/stagemanager": [34],
		"/schedules/tech": [35],
		"/settimes": [36],
		"/settings": [37],
		"/sultanshepard/djshow": [38],
		"/sultanshepard/djshow/[id]": [39],
		"/sultanshepard/tour": [40],
		"/wifi/corpo": [41],
		"/wifi/ncg": [42]
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