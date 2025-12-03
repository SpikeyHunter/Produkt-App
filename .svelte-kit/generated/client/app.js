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
	() => import('./nodes/30')
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
		"/booking/customers": [9],
		"/calendar": [10],
		"/dashboard": [11],
		"/letter": [12],
		"/login/forgot-password": [13],
		"/login/register": [14],
		"/login/reset-confirmed": [15],
		"/login/reset-password": [16],
		"/marketing/comptickets": [17],
		"/marketing/eventsinfo": [18],
		"/ncgapp/controlcenter": [19],
		"/production/backline": [~20],
		"/production/emailtech": [21],
		"/production/showbudget": [22],
		"/schedules/stagemanager": [23],
		"/schedules/tech": [24],
		"/settimes": [25],
		"/settings": [26],
		"/sultanshepard/djshow": [27],
		"/sultanshepard/djshow/[id]": [28],
		"/wifi/corpo": [29],
		"/wifi/ncg": [30]
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