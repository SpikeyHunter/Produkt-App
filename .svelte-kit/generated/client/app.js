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
	() => import('./nodes/35')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/advancing/artistliaison": [3],
		"/advancing/gathered": [4],
		"/advancing/gathered/[event_param]": [5],
		"/advancing/hoteltracker": [6],
		"/advancing/localartists": [7],
		"/auth/verify": [8],
		"/booking/artistavailability": [9],
		"/booking/talentpayments": [10],
		"/calendar": [11],
		"/calendar/[id]": [12],
		"/dashboard": [13],
		"/letter": [14],
		"/login/forgot-password": [15],
		"/login/register": [16],
		"/login/reset-confirmed": [17],
		"/login/reset-password": [18],
		"/marketing/comparehub": [19],
		"/marketing/comptickets": [20],
		"/marketing/customers": [21],
		"/marketing/eventsinfo": [22],
		"/ncgapp/controlcenter": [23],
		"/production/backline": [~24],
		"/production/emailtech": [25],
		"/production/showbudget": [26],
		"/public/invoice/[token]": [27],
		"/schedules/stagemanager": [28],
		"/schedules/tech": [29],
		"/settimes": [30],
		"/settings": [31],
		"/sultanshepard/djshow": [32],
		"/sultanshepard/djshow/[id]": [33],
		"/wifi/corpo": [34],
		"/wifi/ncg": [35]
	};

export const hooks = {
	handleError: (({ error }) => { console.error(error) }),
	
	reroute: (() => {}),
	transport: {}
};

export const decoders = Object.fromEntries(Object.entries(hooks.transport).map(([k, v]) => [k, v.decode]));

export const hash = false;

export const decode = (type, value) => decoders[type](value);

export { default as root } from '../root.js';