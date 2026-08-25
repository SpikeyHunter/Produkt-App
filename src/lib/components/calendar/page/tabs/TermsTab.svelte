<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabase';
	import {
		listTcTemplates,
		getDefaultTcTemplate,
		eventTypeOf,
		type TcTemplate
	} from '$lib/services/templateService';
	import RichTextEditor from '$lib/components/common/RichTextEditor.svelte';
	import {
		getCachedDealPayload,
		setCachedDealPayload
	} from '$lib/components/calendar/page/tabs/deals/eventDealCache';

	export let userRole: string = 'Email Only';
	export let event: any = null;
	export let viewedVersionNum: number = 1;
	export let overrideCalendarData: any = null;

	$: hasAccess = ['Editor', 'Admin'].includes(userRole);
	$: currentVersionNum = event?.calendar?.current_version || 1;
	$: isViewOnly = viewedVersionNum > 0 && viewedVersionNum !== currentVersionNum;

	// Two sections: Deal Terms and Terms & Conditions. Each loads its default
	// template until this event customizes it — only customized sections are
	// written to the event's data, so templates keep flowing into untouched
	// events.
	let section: 'deal' | 'tc' = 'deal';

	let dealTemplates: TcTemplate[] = [];
	let tcTemplates: TcTemplate[] = [];

	let dealContent = '';
	let dealTemplateName = '';
	let dealCustomized = false;
	let tcContent = '';
	let tcTemplateName = '';
	let tcCustomized = false;

	let isInitialized = false;
	let isSaving = false;
	let statusText = '';
	let saveTimeout: ReturnType<typeof setTimeout>;

	$: targetId = event?.calendar?.id || event?.group_id || event?.id;
	// Each section only offers its own category's templates; loading one
	// overrides the default for this event.
	$: activeTemplates = section === 'deal' ? dealTemplates : tcTemplates;
	$: activeTemplateName = section === 'deal' ? dealTemplateName : tcTemplateName;
	$: activeCustomized = section === 'deal' ? dealCustomized : tcCustomized;

	function parseDeal(raw: any): any {
		if (!raw) return {};
		if (typeof raw === 'object') return raw;
		try {
			let p = JSON.parse(raw);
			if (typeof p === 'string') p = JSON.parse(p);
			return p;
		} catch {
			return {};
		}
	}

	async function loadLatestDealPayload(): Promise<any> {
		// Prefer what this session last wrote (Deals tab shares the same cache),
		// otherwise read fresh from the DB so we never resurrect stale data.
		const cached = getCachedDealPayload(event, viewedVersionNum);
		if (cached) return parseDeal(cached);
		const { data } = await supabase
			.from('calendar_data')
			.select('event_deal')
			.eq('calendar_id', targetId)
			.eq('version_number', viewedVersionNum)
			.maybeSingle();
		return parseDeal(data?.event_deal);
	}

	onMount(async () => {
		const all = await listTcTemplates();
		dealTemplates = all.filter((t) => t.category === 'Deal Terms');
		tcTemplates = all.filter((t) => t.category === 'Additional Terms and Conditions');

		const payload = await loadLatestDealPayload();

		const savedTc = payload?.termsAndConditions;
		if (savedTc?.content !== undefined && savedTc?.content !== null) {
			tcContent = savedTc.content;
			tcTemplateName = savedTc.templateName || '';
			tcCustomized = true;
		} else {
			const def =
				tcTemplates.find((t) => t.isDefault) ||
				(await getDefaultTcTemplate('Additional Terms and Conditions'));
			if (def) {
				tcContent = def.content;
				tcTemplateName = def.name;
			}
		}

		const savedDeal = payload?.dealTerms;
		if (savedDeal?.content !== undefined && savedDeal?.content !== null) {
			dealContent = savedDeal.content;
			dealTemplateName = savedDeal.templateName || '';
			dealCustomized = true;
		} else {
			const def = await getDefaultTcTemplate('Deal Terms', eventTypeOf(event));
			if (def) {
				dealContent = def.content;
				dealTemplateName = def.name;
			}
		}

		isInitialized = true;
	});

	function applyTemplate(t: TcTemplate) {
		if (isViewOnly) return;
		if (section === 'deal') {
			dealContent = t.content;
			dealTemplateName = t.name;
			dealCustomized = true;
		} else {
			tcContent = t.content;
			tcTemplateName = t.name;
			tcCustomized = true;
		}
		triggerSave();
	}

	function onEdit(which: 'deal' | 'tc') {
		if (which === 'deal') dealCustomized = true;
		else tcCustomized = true;
		triggerSave();
	}

	function triggerSave() {
		if (!isInitialized || isViewOnly || !hasAccess || !targetId) return;
		clearTimeout(saveTimeout);
		statusText = '';
		saveTimeout = setTimeout(saveNow, 500);
	}

	async function saveNow() {
		isSaving = true;
		try {
			// Read-merge-write so we never clobber deals saved by the Deals tab.
			// Only customized sections are stored on the event — untouched ones
			// keep following their default template.
			const payload = await loadLatestDealPayload();
			if (tcCustomized) {
				payload.termsAndConditions = {
					content: tcContent,
					templateName: tcTemplateName,
					updatedAt: new Date().toISOString()
				};
			}
			if (dealCustomized) {
				payload.dealTerms = {
					content: dealContent,
					templateName: dealTemplateName,
					updatedAt: new Date().toISOString()
				};
			}

			const { error } = await supabase
				.from('calendar_data')
				.update({ event_deal: payload })
				.eq('calendar_id', targetId)
				.eq('version_number', viewedVersionNum);
			if (error) throw error;

			setCachedDealPayload(event, viewedVersionNum, payload);
			if (overrideCalendarData) overrideCalendarData.event_deal = payload;
			if (event?.calendar_data) event.calendar_data.event_deal = payload;
			statusText = 'Saved';
		} catch (err) {
			console.error('❌ [T&C] Failed to save terms:', err);
			statusText = 'Save failed';
		} finally {
			isSaving = false;
		}
	}
</script>

{#if !hasAccess}
	<div class="flex-1 flex items-center justify-center p-6 bg-navbar">
		<p class="text-gray2 font-bold text-lg">You do not have permission to view this.</p>
	</div>
{:else}
	<div class="p-6 flex-1 min-h-0 overflow-hidden flex flex-col gap-4 bg-navbar">
		<div class="flex flex-wrap items-center justify-between gap-4 shrink-0">
			<div class="flex items-center gap-4 flex-wrap">
				<div class="flex gap-2">
					<button
						type="button"
						class="px-5 py-2 rounded-full text-sm font-black cursor-pointer {section === 'deal'
							? 'bg-lime text-black'
							: 'bg-gray1 text-gray2 hover:text-white'}"
						on:click={() => (section = 'deal')}
					>
						Deal Terms
					</button>
					<button
						type="button"
						class="px-5 py-2 rounded-full text-sm font-black cursor-pointer {section === 'tc'
							? 'bg-lime text-black'
							: 'bg-gray1 text-gray2 hover:text-white'}"
						on:click={() => (section = 'tc')}
					>
						Terms &amp; Conditions
					</button>
				</div>
				<p class="text-gray2 text-xs font-bold">Applicable for this event only</p>
			</div>

			<div class="flex items-center gap-3">
				{#if isSaving}
					<span class="text-xs font-bold text-gray2">Saving...</span>
				{:else if statusText}
					<span class="text-xs font-bold {statusText === 'Saved' ? 'text-lime' : 'text-problem'}">{statusText}</span>
				{/if}

				{#if activeTemplates.length > 0 && !isViewOnly}
					<div class="relative group">
						<button
							type="button"
							class="px-4 py-2 bg-gray1 text-gray3 text-sm font-bold rounded-3xl hover:text-lime transition-colors cursor-pointer"
						>
							Load Template ▾
						</button>
						<div
							class="absolute right-0 top-full pt-1 w-64 hidden group-hover:block group-focus-within:block z-50"
						>
							<div class="bg-gray1 border border-navbar rounded-xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
								{#each activeTemplates as t (t.id)}
									<button
										type="button"
										on:click={() => applyTemplate(t)}
										class="w-full text-left px-4 py-2.5 text-sm text-white hover:text-lime hover:bg-navbar transition-colors cursor-pointer"
									>
										<span class="truncate block">{t.name}</span>
									</button>
								{/each}
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if isInitialized}
			<div class="flex-1 min-h-0">
				{#if section === 'deal'}
					<RichTextEditor
						bind:value={dealContent}
						onInput={() => onEdit('deal')}
						disabled={isViewOnly}
						fill
						placeholder="Deal terms for this event — printed in the Deal Terms section of the offer PDF."
					/>
				{:else}
					<RichTextEditor
						bind:value={tcContent}
						onInput={() => onEdit('tc')}
						disabled={isViewOnly}
						fill
						placeholder="Terms & conditions for this event — headings become bold section headers on the offer PDF."
					/>
				{/if}
			</div>
		{:else}
			<p class="text-gray2 font-bold text-sm py-8 text-center">Loading...</p>
		{/if}
	</div>
{/if}
