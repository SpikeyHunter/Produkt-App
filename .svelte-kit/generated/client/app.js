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
	() => import('./nodes/34')
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
		"/dashboard": [12],
		"/letter": [13],
		"/login/forgot-password": [14],
		"/login/register": [15],
		"/login/reset-confirmed": [16],
		"/login/reset-password": [17],
		"/marketing/comparehub": [18],
		"/marketing/comptickets": [19],
		"/marketing/customers": [20],
		"/marketing/eventsinfo": [21],
		"/ncgapp/controlcenter": [22],
		"/production/backline": [~23],
		"/production/emailtech": [24],
		"/production/showbudget": [25],
		"/public/invoice/[token]": [26],
		"/schedules/stagemanager": [27],
		"/schedules/tech": [28],
		"/settimes": [29],
		"/settings": [30],
		"/sultanshepard/djshow": [31],
		"/sultanshepard/djshow/[id]": [32],
		"/wifi/corpo": [33],
		"/wifi/ncg": [34]
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