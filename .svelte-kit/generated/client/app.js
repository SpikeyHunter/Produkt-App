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
	() => import('./nodes/40')
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
		"/calendar": [~14],
		"/calendar/unsubscribe": [16],
		"/calendar/[id]/[[tab]]": [15],
		"/dashboard": [17],
		"/letter": [18],
		"/login/forgot-password": [19],
		"/login/register": [20],
		"/login/reset-confirmed": [21],
		"/login/reset-password": [22],
		"/marketing/comparehub": [23],
		"/marketing/comptickets": [24],
		"/marketing/customers": [25],
		"/marketing/eventsinfo": [26],
		"/ncgapp/controlcenter": [27],
		"/production/backline": [~28],
		"/production/emailtech": [29],
		"/production/showbudget": [30],
		"/production/techrider": [31],
		"/public/invoice/[token]": [32],
		"/schedules/stagemanager": [33],
		"/schedules/tech": [34],
		"/settimes": [35],
		"/settings": [36],
		"/sultanshepard/djshow": [37],
		"/sultanshepard/djshow/[id]": [38],
		"/wifi/corpo": [39],
		"/wifi/ncg": [40]
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