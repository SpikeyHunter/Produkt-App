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
	() => import('./nodes/31')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/advancing/artistliaison": [3],
		"/advancing/gathered": [4],
		"/advancing/gathered/[event_param]": [5],
		"/advancing/localartists": [6],
		"/auth/verify": [7],
		"/booking/artistavailability": [8],
		"/booking/comparehub": [9],
		"/booking/customers": [10],
		"/calendar": [11],
		"/dashboard": [12],
		"/letter": [13],
		"/login/forgot-password": [14],
		"/login/register": [15],
		"/login/reset-confirmed": [16],
		"/login/reset-password": [17],
		"/marketing/comptickets": [18],
		"/marketing/eventsinfo": [19],
		"/ncgapp/controlcenter": [20],
		"/production/backline": [~21],
		"/production/emailtech": [22],
		"/production/showbudget": [23],
		"/schedules/stagemanager": [24],
		"/schedules/tech": [25],
		"/settimes": [26],
		"/settings": [27],
		"/sultanshepard/djshow": [28],
		"/sultanshepard/djshow/[id]": [29],
		"/wifi/corpo": [30],
		"/wifi/ncg": [31]
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