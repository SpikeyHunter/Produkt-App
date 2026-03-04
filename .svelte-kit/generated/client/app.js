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
	() => import('./nodes/39')
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
		"/booking/artistavailability": [10],
		"/booking/talentpayments": [11],
		"/calendar": [~12],
		"/calendar/unsubscribe": [14],
		"/calendar/[id]/[[tab]]": [13],
		"/contact-card": [15],
		"/dashboard": [16],
		"/letter": [17],
		"/login/forgot-password": [18],
		"/login/register": [19],
		"/login/reset-confirmed": [20],
		"/login/reset-password": [21],
		"/marketing/comparehub": [22],
		"/marketing/comptickets": [23],
		"/marketing/customers": [24],
		"/marketing/eventsinfo": [25],
		"/ncgapp/controlcenter": [26],
		"/production/backline": [~27],
		"/production/emailtech": [28],
		"/production/showbudget": [29],
		"/production/techrider": [30],
		"/public/invoice/[token]": [31],
		"/schedules/stagemanager": [32],
		"/schedules/tech": [33],
		"/settimes": [34],
		"/settings": [35],
		"/sultanshepard/djshow": [36],
		"/sultanshepard/djshow/[id]": [37],
		"/wifi/corpo": [38],
		"/wifi/ncg": [39]
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