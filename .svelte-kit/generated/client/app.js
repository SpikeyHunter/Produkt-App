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
	() => import('./nodes/21')
];

export const server_loads = [];

export const dictionary = {
		"/": [2],
		"/advancing/gathered": [3],
		"/advancing/gathered/[event_param]": [4],
		"/auth/verify": [5],
		"/booking/artistavailability": [6],
		"/booking/customers": [7],
		"/calendar": [8],
		"/dashboard": [9],
		"/letter": [10],
		"/login/forgot-password": [11],
		"/login/register": [12],
		"/login/reset-confirmed": [13],
		"/login/reset-password": [14],
		"/marketing/comptickets": [15],
		"/marketing/eventsinfo": [16],
		"/production/backline": [17],
		"/production/emailtech": [18],
		"/settimes": [19],
		"/settings": [20],
		"/wifi": [21]
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