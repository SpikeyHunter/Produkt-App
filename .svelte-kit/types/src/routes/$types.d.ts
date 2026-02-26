import type * as Kit from '@sveltejs/kit';

type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;
// @ts-ignore
type MatcherParam<M> = M extends (param : string) => param is infer U ? U extends string ? U : string : string;
type RouteParams = {  };
type RouteId = '/';
type MaybeWithVoid<T> = {} extends T ? T | void : T;
export type RequiredKeys<T> = { [K in keyof T]-?: {} extends { [P in K]: T[K] } ? never : K; }[keyof T];
type OutputDataShape<T> = MaybeWithVoid<Omit<App.PageData, RequiredKeys<T>> & Partial<Pick<App.PageData, keyof T & keyof App.PageData>> & Record<string, any>>
type EnsureDefined<T> = T extends null | undefined ? {} : T;
type OptionalUnion<U extends Record<string, any>, A extends keyof U = U extends U ? keyof U : never> = U extends unknown ? { [P in Exclude<A, keyof U>]?: never } & U : never;
export type Snapshot<T = any> = Kit.Snapshot<T>;
type PageParentData = EnsureDefined<LayoutData>;
type LayoutRouteId = RouteId | "/" | "/advancing/artistliaison" | "/advancing/gathered" | "/advancing/gathered/[event_param]" | "/advancing/hoteltracker" | "/advancing/localartists" | "/advancing/merchsettlement" | "/auth/verify" | "/booking/artistavailability" | "/booking/talentpayments" | "/calendar" | "/calendar/[id]" | "/calendar/unsubscribe" | "/dashboard" | "/letter" | "/login/forgot-password" | "/login/register" | "/login/reset-confirmed" | "/login/reset-password" | "/marketing/comparehub" | "/marketing/comptickets" | "/marketing/customers" | "/marketing/eventsinfo" | "/ncgapp/controlcenter" | "/production/backline" | "/production/emailtech" | "/production/showbudget" | "/production/techrider" | "/public/invoice/[token]" | "/schedules/stagemanager" | "/schedules/tech" | "/settimes" | "/settings" | "/sultanshepard/djshow" | "/sultanshepard/djshow/[id]" | "/wifi/corpo" | "/wifi/ncg" | null
type LayoutParams = RouteParams & { event_param?: string; id?: string; token?: string }
type LayoutParentData = EnsureDefined<{}>;

export type PageServerData = null;
export type PageData = Expand<PageParentData>;
export type PageProps = { params: RouteParams; data: PageData }
export type LayoutServerData = null;
export type LayoutData = Expand<LayoutParentData>;
export type LayoutProps = { params: LayoutParams; data: LayoutData; children: import("svelte").Snippet }