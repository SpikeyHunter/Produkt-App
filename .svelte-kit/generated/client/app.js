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
	() => import('./nodes/43'),
	() => import('./nodes/44')
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
		"/booking/comparehub": [12],
		"/booking/contracts": [13],
		"/booking/dailycount": [14],
		"/booking/talentpayments": [15],
		"/boxoffice": [16],
		"/calendar": [~17],
		"/calendar/unsubscribe": [19],
		"/calendar/[id]/[[tab]]": [18],
		"/dashboard": [20],
		"/letter": [21],
		"/login/forgot-password": [22],
		"/login/register": [23],
		"/login/reset-confirmed": [24],
		"/login/reset-password": [25],
		"/marketing/comptickets": [26],
		"/marketing/customers": [27],
		"/marketing/eventsinfo": [28],
		"/ncgapp/controlcenter": [29],
		"/privacy": [30],
		"/production/backline": [~31],
		"/production/emailtech": [32],
		"/production/showbudget": [33],
		"/production/techrider": [34],
		"/public/invoice/[token]": [35],
		"/schedules/stagemanager": [36],
		"/schedules/tech": [37],
		"/settimes": [38],
		"/settings": [39],
		"/sultanshepard/djshow": [40],
		"/sultanshepard/djshow/[id]": [41],
		"/sultanshepard/tour": [42],
		"/wifi/corpo": [43],
		"/wifi/ncg": [44]
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