<script lang="ts">
	import { onMount } from 'svelte';
	import RichTextEditor from '$lib/components/common/RichTextEditor.svelte';
	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import FixedCosts from '$lib/components/calendar/page/tabs/costs/FixedCosts.svelte';
	import { portal } from '$lib/utils/portalUtils';
	import {
		listEventTemplates,
		saveEventTemplate,
		deleteTemplate,
		listTcTemplates,
		saveTcTemplate,
		setDefaultTcTemplate,
		templateCategoryHasContent,
		normalizeAddMode,
		EVENT_TEMPLATE_CATEGORIES,
		EVENT_TYPE_OPTIONS,
		type EventTemplate,
		type TcTemplate,
		type TextTemplateCategory
	} from '$lib/services/templateService';

	export let initialSection: 'text' | 'event' = 'text';
	// Bound upward so the Settings view's back-button guard sees editor changes.
	export let dirtyOut = false;

	let section: 'text' | 'event' = initialSection;

	const variableTypes = ['Flat', '% of Gross', '% of Net Gross', '$ per Paid Ticket', '$ per Attendee'];
	const variableTypeOptions = variableTypes.map((v) => ({ value: v, label: v }));
	const textCategoryOptions: { value: TextTemplateCategory; label: string }[] = [
		{ value: 'Additional Terms and Conditions', label: 'Additional Terms and Conditions' },
		{ value: 'Deal Terms', label: 'Deal Terms' }
	];

	let loading = true;
	let saving = false;
	let eventTemplates: EventTemplate[] = [];
	let tcTemplates: TcTemplate[] = [];
	let search = '';

	// null = list view; otherwise the template being edited
	let editingEvent: EventTemplate | null = null;
	let editingTc: TcTemplate | null = null;

	onMount(refresh);

	async function refresh() {
		loading = true;
		[eventTemplates, tcTemplates] = await Promise.all([listEventTemplates(), listTcTemplates()]);
		loading = false;
	}

	$: filteredEvent = eventTemplates.filter((t) =>
		t.name.toLowerCase().includes(search.toLowerCase())
	);
	// Sorted by Type A-Z, then Name A-Z.
	$: filteredTc = tcTemplates
		.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
		.slice()
		.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

	// ---------------- Unsaved-changes guard ----------------
	let editSnapshot = '';
	let showLeaveModal = false;
	let pendingAction: (() => void) | null = null;

	$: editorDirty = editingTc
		? JSON.stringify(editingTc) !== editSnapshot
		: editingEvent
			? JSON.stringify(editingEvent) !== editSnapshot
			: false;
	$: dirtyOut = editorDirty;

	/** Runs the action immediately, or prompts first when the open editor has
	 *  unsaved changes. */
	function guarded(action: () => void) {
		if (editorDirty) {
			pendingAction = action;
			showLeaveModal = true;
		} else {
			action();
		}
	}

	async function leaveSaveNow() {
		await saveCurrent();
		showLeaveModal = false;
		pendingAction?.();
		pendingAction = null;
	}

	function leaveAnyway() {
		showLeaveModal = false;
		editingTc = null;
		editingEvent = null;
		pendingAction?.();
		pendingAction = null;
	}

	/** Saves whichever editor is open (used by the Settings back-button guard). */
	export async function saveCurrent() {
		if (editingTc) await saveTc();
		else if (editingEvent) await saveEvent();
	}

	function switchSection(next: 'text' | 'event') {
		guarded(() => {
			section = next;
			editingTc = null;
			editingEvent = null;
		});
	}

	// ---------------- Text templates ----------------
	function newTcTemplate() {
		editingTc = {
			id: null,
			name: '',
			category: 'Additional Terms and Conditions',
			content: '',
			isDefault: false,
			eventTypes: []
		};
		editSnapshot = JSON.stringify(editingTc);
	}

	function editTcTemplate(t: TcTemplate) {
		const copy = JSON.parse(JSON.stringify(t));
		if (!Array.isArray(copy.eventTypes)) copy.eventTypes = [];
		editingTc = copy;
		editSnapshot = JSON.stringify(editingTc);
	}

	// Deal Terms: multi-select of associated event types (replaces the default star).
	let typesOpen = false;

	function toggleEventType(t: string) {
		if (!editingTc) return;
		editingTc.eventTypes = editingTc.eventTypes.includes(t)
			? editingTc.eventTypes.filter((x) => x !== t)
			: [...editingTc.eventTypes, t];
	}

	function typesOutside(node: HTMLElement) {
		const handler = (e: MouseEvent) => {
			if (!node.contains(e.target as Node)) typesOpen = false;
		};
		document.addEventListener('click', handler, true);
		return { destroy: () => document.removeEventListener('click', handler, true) };
	}

	async function saveTc() {
		if (!editingTc || !editingTc.name.trim() || saving) return;
		saving = true;
		const wasDefault = editingTc.isDefault && editingTc.category !== 'Deal Terms';
		const id = await saveTcTemplate(editingTc);
		if (wasDefault && id) await setDefaultTcTemplate(id);
		saving = false;
		editingTc = null;
		await refresh();
	}

	async function makeDefault(t: TcTemplate) {
		if (!t.id) return;
		await setDefaultTcTemplate(t.id);
		await refresh();
	}

	// Deleting always confirms first.
	let deleteTarget: { id: string; name: string } | null = null;
	let deleting = false;

	function removeTemplateRow(t: { id: string | null; name: string }) {
		if (!t.id) return;
		deleteTarget = { id: t.id, name: t.name };
	}

	async function confirmDelete() {
		if (!deleteTarget || deleting) return;
		deleting = true;
		await deleteTemplate(deleteTarget.id);
		deleting = false;
		deleteTarget = null;
		await refresh();
	}

	// ---------------- Event templates ----------------
	let fixedExpanded = true;
	let variableExpanded = false;
	let ticketsExpanded = false;
	const noopSave = () => {};

	function newEventTemplate() {
		editingEvent = {
			id: null,
			name: '',
			fixedCosts: [],
			variableCosts: [],
			tickets: [],
			addMode: normalizeAddMode(null)
		};
		editSnapshot = JSON.stringify(editingEvent);
		fixedExpanded = true;
		variableExpanded = true;
		ticketsExpanded = true;
	}

	function editEventTemplate(t: EventTemplate) {
		const copy = JSON.parse(JSON.stringify(t));
		copy.addMode = normalizeAddMode(copy.addMode);
		editingEvent = copy;
		editSnapshot = JSON.stringify(editingEvent);
		fixedExpanded = true;
		variableExpanded = false;
		ticketsExpanded = false;
	}

	async function saveEvent() {
		if (!editingEvent || !editingEvent.name.trim() || saving) return;
		saving = true;
		await saveEventTemplate(editingEvent);
		saving = false;
		editingEvent = null;
		await refresh();
	}

	function addVariableLine() {
		if (!editingEvent) return;
		editingEvent.variableCosts = [
			...editingEvent.variableCosts,
			{
				id: crypto.randomUUID(),
				name: `Variable Cost ${editingEvent.variableCosts.length + 1}`,
				type: 'Flat',
				amount: 0
			}
		];
	}
	function removeVariableLine(id: string) {
		if (!editingEvent) return;
		editingEvent.variableCosts = editingEvent.variableCosts.filter((v) => v.id !== id);
	}
	function addTicketRow() {
		if (!editingEvent) return;
		editingEvent.tickets = [
			...editingEvent.tickets,
			{
				id: crypto.randomUUID(),
				name: `Tier ${editingEvent.tickets.length + 1}`,
				allotment: 0,
				comps: 0,
				kills: 0,
				price: 0,
				estSold: 0
			}
		];
	}
	function removeTicketRow(id: string) {
		if (!editingEvent) return;
		editingEvent.tickets = editingEvent.tickets.filter((t) => t.id !== id);
	}

	const sellable = (t: any) =>
		(Number(t.allotment) || 0) - (Number(t.comps) || 0) - (Number(t.kills) || 0);
	const potentialGross = (t: any) => sellable(t) * (Number(t.price) || 0);
	const money = (v: number) =>
		(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	function eventTemplateSummary(t: EventTemplate): string {
		const fixed = t.fixedCosts.reduce((s, g) => s + g.costs.length, 0);
		return `${fixed} fixed · ${t.variableCosts.length} variable · ${t.tickets.length} tiers`;
	}

	function eventTemplateCategories(t: EventTemplate): string {
		const cats = EVENT_TEMPLATE_CATEGORIES.filter((c) => templateCategoryHasContent(t, c));
		return cats.length ? cats.join(', ') : 'Empty';
	}

	const cellInput =
		'w-full bg-transparent border-b border-transparent focus:border-lime focus:outline-none text-sm text-white';
	const thCls = 'px-3 py-2 text-[10px] font-black uppercase tracking-widest text-gray2';
</script>

<div class="flex flex-col gap-4">
	<!-- Header: section tabs always visible + search -->
	<div class="flex items-center justify-between gap-3 flex-wrap">
		<div class="flex gap-2">
			<button
				type="button"
				class="px-5 py-2 rounded-full text-sm font-black cursor-pointer {section === 'text'
					? 'bg-lime text-black'
					: 'bg-gray1 text-gray2 hover:text-white'}"
				on:click={() => switchSection('text')}
			>
				Text Templates
			</button>
			<button
				type="button"
				class="px-5 py-2 rounded-full text-sm font-black cursor-pointer {section === 'event'
					? 'bg-lime text-black'
					: 'bg-gray1 text-gray2 hover:text-white'}"
				on:click={() => switchSection('event')}
			>
				Event Templates
			</button>
		</div>
		{#if !editingTc && !editingEvent}
			<div class="relative">
				<svg
					class="w-4 h-4 text-gray2 absolute left-3.5 top-1/2 -translate-y-1/2"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2.5"
					stroke-linecap="round"
					><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg
				>
				<input
					type="text"
					bind:value={search}
					placeholder="Search templates"
					class="bg-gray1 rounded-3xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray2 focus:outline-none w-56"
				/>
			</div>
		{/if}
	</div>

	{#if loading}
		<p class="text-gray2 font-bold text-sm py-6 text-center">Loading templates...</p>
	{:else if section === 'text'}
		{#if !editingTc}
			<!-- Text template list -->
			<div class="flex flex-col gap-2">
				<div class="grid grid-cols-[1fr_220px_120px] gap-2 px-4 text-[10px] font-black uppercase tracking-widest text-gray2">
					<span>Name</span><span>Type</span><span class="text-right">Actions</span>
				</div>
				{#each filteredTc as t (t.id)}
					<div class="grid grid-cols-[1fr_220px_120px] gap-2 items-center bg-gray1 rounded-2xl px-4 py-2.5">
						<p class="text-white font-bold text-sm flex items-center gap-2 min-w-0">
							<span class="truncate">{t.name}</span>
							{#if t.isDefault}
								<span class="text-[9px] font-black uppercase tracking-widest bg-lime text-black rounded-full px-2 py-0.5 shrink-0">Default</span>
							{/if}
						</p>
						<p class="text-gray2 text-xs font-bold truncate">
							{t.category}{t.category === 'Deal Terms' && t.eventTypes?.length
								? ` · ${t.eventTypes.join(', ')}`
								: ''}
						</p>
						<div class="flex items-center gap-1 justify-end">
							{#if !t.isDefault && t.category !== 'Deal Terms'}
								<button
									type="button"
									on:click={() => makeDefault(t)}
									title="Set as default for its type"
									class="w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-lime cursor-pointer"
									aria-label="Set default"
								>
									<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
								</button>
							{/if}
							<button
								type="button"
								on:click={() => editTcTemplate(t)}
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-white cursor-pointer"
								aria-label="Edit"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
							</button>
							<button
								type="button"
								on:click={() => removeTemplateRow(t)}
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-problem cursor-pointer"
								aria-label="Remove"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
							</button>
						</div>
					</div>
				{:else}
					<p class="text-gray2 text-sm font-bold py-4 text-center">No text templates yet.</p>
				{/each}

				<button
					type="button"
					on:click={newTcTemplate}
					class="mt-1 px-2 text-lime font-bold flex items-center gap-2 hover:opacity-80 cursor-pointer w-max text-sm"
				>
					<span class="text-xl bg-lime text-black rounded-full w-5 h-5 flex items-center justify-center pb-0.5">+</span>
					New Text Template
				</button>
			</div>
		{:else}
			<!-- Text template editor -->
			<div class="flex flex-col gap-4">
				<h4 class="text-sm font-black uppercase tracking-widest text-gray3">
					{editingTc.id ? `Edit: ${editingTc.name}` : 'New Text Template'}
				</h4>
				<div>
					<label class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest" for="tt-name">Name</label>
					<input
						id="tt-name"
						type="text"
						bind:value={editingTc.name}
						placeholder="Template name"
						class="w-full bg-gray1 rounded-xl px-4 py-2 text-sm font-bold text-white placeholder-gray2 focus:outline-none"
					/>
				</div>
				<div class="flex items-end gap-6">
					<div class="flex-1 max-w-md">
						<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Text Template Type</span>
						<Dropdown options={textCategoryOptions} bind:value={editingTc.category} />
					</div>
					{#if editingTc.category === 'Deal Terms'}
						<!-- Deal Terms are picked by the event's type, not a single default. -->
						<div class="flex-1 max-w-md relative" use:typesOutside>
							<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Default for Event Types</span>
							<button
								type="button"
								on:click={() => (typesOpen = !typesOpen)}
								class="w-full flex items-center justify-between gap-2 bg-gray1 text-sm rounded-xl px-3.5 py-2 font-bold focus:outline-none cursor-pointer {editingTc.eventTypes.length
									? 'text-white'
									: 'text-gray2'}"
							>
								<span class="truncate">
									{editingTc.eventTypes.length ? editingTc.eventTypes.join(', ') : 'No event types'}
								</span>
								<svg class="w-3.5 h-3.5 shrink-0 text-gray2 {typesOpen ? 'rotate-180' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
							</button>
							{#if typesOpen}
								<div class="absolute left-0 top-full mt-1 min-w-full bg-gray1 border border-navbar rounded-xl shadow-2xl z-[90] overflow-hidden">
									<div class="max-h-64 overflow-y-auto custom-scrollbar py-1">
										{#each EVENT_TYPE_OPTIONS as t (t)}
											{@const on = editingTc.eventTypes.includes(t)}
											<button
												type="button"
												on:click={() => toggleEventType(t)}
												class="w-full flex items-center justify-between gap-3 text-left px-3.5 py-2 text-sm font-bold transition-colors cursor-pointer {on
													? 'text-lime'
													: 'text-white hover:text-lime hover:bg-navbar'}"
											>
												{t}
												<span class="w-4 h-4 rounded-md flex items-center justify-center {on ? 'bg-lime' : 'border border-gray2/40'}">
													{#if on}
														<svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
													{/if}
												</span>
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					{:else}
						<div class="flex items-center gap-3 pb-1.5">
							<span class="text-xs font-bold {editingTc.isDefault ? 'text-white' : 'text-gray2'}">Default for this type</span>
							<button
								type="button"
								role="switch"
								aria-checked={editingTc.isDefault}
								aria-label="Default for this type"
								on:click={() => editingTc && (editingTc.isDefault = !editingTc.isDefault)}
								class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none {editingTc.isDefault
									? 'bg-lime'
									: 'bg-[#444]'}"
							>
								<span
									aria-hidden="true"
									class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {editingTc.isDefault
										? 'translate-x-5'
										: 'translate-x-0'}"
								></span>
							</button>
						</div>
					{/if}
				</div>
				<div>
					<span class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest">Content</span>
					<RichTextEditor
						bind:value={editingTc.content}
						placeholder="Template content shown on offer sheets..."
					/>
				</div>

				<div class="flex gap-3 justify-end">
					<button
						type="button"
						on:click={() => guarded(() => (editingTc = null))}
						class="px-6 py-2.5 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 cursor-pointer"
						>Cancel</button
					>
					<button
						type="button"
						on:click={saveTc}
						disabled={saving || !editingTc.name.trim()}
						class="px-6 py-2.5 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 cursor-pointer disabled:opacity-40"
					>
						{saving ? 'Saving...' : 'Save Template'}
					</button>
				</div>
			</div>
		{/if}
	{:else if section === 'event'}
		{#if !editingEvent}
			<!-- Event template list -->
			<div class="flex flex-col gap-2">
				<div class="grid grid-cols-[1fr_260px_90px] gap-2 px-4 text-[10px] font-black uppercase tracking-widest text-gray2">
					<span>Name</span><span>Categories</span><span class="text-right">Actions</span>
				</div>
				{#each filteredEvent as t (t.id)}
					<div class="grid grid-cols-[1fr_260px_90px] gap-2 items-center bg-gray1 rounded-2xl px-4 py-2.5">
						<div class="min-w-0">
							<p class="text-white font-bold text-sm truncate">{t.name}</p>
							<p class="text-gray2 text-xs font-medium mt-0.5">{eventTemplateSummary(t)}</p>
						</div>
						<p class="text-gray2 text-xs font-bold truncate">{eventTemplateCategories(t)}</p>
						<div class="flex items-center gap-1 justify-end">
							<button
								type="button"
								on:click={() => editEventTemplate(t)}
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-white cursor-pointer"
								aria-label="Edit"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
							</button>
							<button
								type="button"
								on:click={() => removeTemplateRow(t)}
								class="w-8 h-8 flex items-center justify-center rounded-lg text-gray2 hover:text-problem cursor-pointer"
								aria-label="Remove"
							>
								<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
							</button>
						</div>
					</div>
				{:else}
					<p class="text-gray2 text-sm font-bold py-4 text-center">No event templates yet.</p>
				{/each}

				<button
					type="button"
					on:click={newEventTemplate}
					class="mt-1 px-2 text-lime font-bold flex items-center gap-2 hover:opacity-80 cursor-pointer w-max text-sm"
				>
					<span class="text-xl bg-lime text-black rounded-full w-5 h-5 flex items-center justify-center pb-0.5">+</span>
					New Event Template
				</button>
			</div>
		{:else}
			<!-- Event template editor: same layout as the Costs tab -->
			<div class="flex flex-col gap-5">
				<h4 class="text-sm font-black uppercase tracking-widest text-gray3">
					{editingEvent.id ? `Edit: ${editingEvent.name}` : 'New Event Template'}
				</h4>
				<div>
					<label class="block text-[11px] font-bold text-gray2 mb-1.5 ml-1 uppercase tracking-widest" for="et-name">Name</label>
					<input
						id="et-name"
						type="text"
						bind:value={editingEvent.name}
						placeholder="Template name"
						class="w-full bg-gray1 rounded-xl px-4 py-2 text-sm font-bold text-white placeholder-gray2 focus:outline-none"
					/>
				</div>

				<div class="flex flex-col gap-1">
					<!-- Fixed Costs: the actual Costs tab component (template variant) -->
					<FixedCosts
						bind:fixedCosts={editingEvent.fixedCosts}
						bind:expanded={fixedExpanded}
						currency="CAD"
						triggerSave={noopSave}
						templateMode
						addModeToggle={editingEvent.addMode.fixed}
						onAddModeChange={(v) => {
							if (editingEvent) editingEvent.addMode = { ...editingEvent.addMode, fixed: v };
						}}
					/>

					<!-- Variable Costs -->
					<section class="flex flex-col">
						<div
							class="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none px-4 py-3 rounded-t-xl transition-colors {variableExpanded
								? 'bg-gray1/80'
								: 'hover:bg-gray1'}"
							role="button"
							tabindex="0"
							on:click={() => (variableExpanded = !variableExpanded)}
							on:keydown={(e) => e.key === 'Enter' && (variableExpanded = !variableExpanded)}
						>
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-lime transition-transform {variableExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
								<h3 class="text-xl font-black text-lime tracking-wide">Variable Costs</h3>
							</div>
							<div class="flex items-center gap-6 text-sm font-bold text-gray2">
								<div>{editingEvent.variableCosts.length} cost{editingEvent.variableCosts.length === 1 ? '' : 's'}</div>
								<div class="flex items-center gap-2 ml-2" role="none" on:click|stopPropagation on:keydown|stopPropagation>
									<span class="text-xs font-bold {editingEvent.addMode.variable ? 'text-white' : 'text-gray2'}">Add Instead of Overwrite</span>
									<button
										type="button"
										role="switch"
										aria-checked={editingEvent.addMode.variable}
										aria-label="Add instead of overwrite"
										on:click|stopPropagation={() => {
											if (editingEvent)
												editingEvent.addMode = { ...editingEvent.addMode, variable: !editingEvent.addMode.variable };
										}}
										class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none {editingEvent.addMode.variable ? 'bg-lime' : 'bg-[#444]'}"
									>
										<span aria-hidden="true" class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {editingEvent.addMode.variable ? 'translate-x-5' : 'translate-x-0'}"></span>
									</button>
								</div>
							</div>
						</div>

						{#if variableExpanded}
							<div class="px-0 pb-6 rounded-b-xl border-t border-gray1/10">
								<div class="flex justify-end items-center pb-4 pt-4">
									<button type="button" on:click={addVariableLine} class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:opacity-90 transition-colors hover:cursor-pointer">Create Variable Cost</button>
								</div>
								<div class="w-full bg-navbar overflow-hidden border border-gray1 rounded-sm">
									<table class="w-full text-xs text-white border-collapse">
										<colgroup><col /><col style="width:14rem" /><col style="width:9rem" /><col style="width:4rem" /></colgroup>
										<thead class="text-xs tracking-wider text-gray2 font-bold bg-navbar border-b border-gray1">
											<tr>
												<th class="{thCls} text-left">Name</th>
												<th class="{thCls} text-left">Type</th>
												<th class="{thCls} text-right">Amount</th>
												<th class="{thCls} text-center">Remove</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray1 bg-gray1/20">
											{#each editingEvent.variableCosts as v (v.id)}
												<tr class="border-b border-gray1">
													<td class="px-3 py-2 border-r border-gray1"><input type="text" bind:value={v.name} class="{cellInput} text-left" /></td>
													<td class="px-3 py-1 border-r border-gray1"><Dropdown options={variableTypeOptions} bind:value={v.type} small /></td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" step="0.01" bind:value={v.amount} class="{cellInput} text-right" /></td>
													<td class="px-0 py-0 text-center">
														<button type="button" on:click={() => removeVariableLine(v.id)} class="w-full h-full min-h-[40px] px-2 text-gray2 hover:text-red-500 hover:bg-red-500/10 hover:cursor-pointer transition-colors font-bold text-lg block">×</button>
													</td>
												</tr>
											{:else}
												<tr><td colspan="4" class="px-3 py-3 text-xs text-gray2 font-bold">No variable costs yet.</td></tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					</section>

					<!-- Ticket Scaling -->
					<section class="flex flex-col">
						<div
							class="flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none px-4 py-3 rounded-t-xl transition-colors {ticketsExpanded
								? 'bg-gray1/80'
								: 'hover:bg-gray1'}"
							role="button"
							tabindex="0"
							on:click={() => (ticketsExpanded = !ticketsExpanded)}
							on:keydown={(e) => e.key === 'Enter' && (ticketsExpanded = !ticketsExpanded)}
						>
							<div class="flex items-center gap-2">
								<svg class="w-6 h-6 text-lime transition-transform {ticketsExpanded ? 'rotate-90' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
								<h3 class="text-xl font-black text-lime tracking-wide">Ticket Scaling</h3>
							</div>
							<div class="flex items-center gap-6 text-sm font-bold text-gray2">
								<div>
									{editingEvent.tickets.length} tier{editingEvent.tickets.length === 1 ? '' : 's'}
									· Potential: <span class="text-white">CA${money(editingEvent.tickets.reduce((s, t) => s + potentialGross(t), 0))}</span>
								</div>
								<div class="flex items-center gap-2 ml-2" role="none" on:click|stopPropagation on:keydown|stopPropagation>
									<span class="text-xs font-bold {editingEvent.addMode.tickets ? 'text-white' : 'text-gray2'}">Add Instead of Overwrite</span>
									<button
										type="button"
										role="switch"
										aria-checked={editingEvent.addMode.tickets}
										aria-label="Add instead of overwrite"
										on:click|stopPropagation={() => {
											if (editingEvent)
												editingEvent.addMode = { ...editingEvent.addMode, tickets: !editingEvent.addMode.tickets };
										}}
										class="relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent focus:outline-none {editingEvent.addMode.tickets ? 'bg-lime' : 'bg-[#444]'}"
									>
										<span aria-hidden="true" class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow ring-0 transition duration-150 {editingEvent.addMode.tickets ? 'translate-x-5' : 'translate-x-0'}"></span>
									</button>
								</div>
							</div>
						</div>

						{#if ticketsExpanded}
							<div class="px-0 pb-6 rounded-b-xl border-t border-gray1/10">
								<div class="flex justify-end items-center pb-4 pt-4">
									<button type="button" on:click={addTicketRow} class="px-4 py-2 bg-lime text-black text-sm font-bold rounded-3xl hover:opacity-90 transition-colors hover:cursor-pointer">Create Ticket</button>
								</div>
								<div class="w-full bg-navbar border border-gray1 rounded-sm overflow-x-auto custom-scrollbar">
									<table class="w-full text-xs text-white border-collapse min-w-[760px]">
										<colgroup><col /><col style="width:6rem" /><col style="width:5rem" /><col style="width:5rem" /><col style="width:6rem" /><col style="width:7rem" /><col style="width:6rem" /><col style="width:8rem" /><col style="width:4rem" /></colgroup>
										<thead class="text-xs tracking-wider text-gray2 font-bold bg-navbar border-b border-gray1">
											<tr>
												<th class="{thCls} text-left">Name</th>
												<th class="{thCls} text-right">Allotment</th>
												<th class="{thCls} text-right">Comps</th>
												<th class="{thCls} text-right">Kills</th>
												<th class="{thCls} text-right">Sellable</th>
												<th class="{thCls} text-right">Price</th>
												<th class="{thCls} text-right">Est. Sold</th>
												<th class="{thCls} text-right">Pot. Gross</th>
												<th class="{thCls} text-center">Remove</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-gray1 bg-gray1/20">
											{#each editingEvent.tickets as t (t.id)}
												<tr class="border-b border-gray1">
													<td class="px-3 py-2 border-r border-gray1"><input type="text" bind:value={t.name} class="{cellInput} text-left" /></td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" bind:value={t.allotment} class="{cellInput} text-right" /></td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" bind:value={t.comps} class="{cellInput} text-right" /></td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" bind:value={t.kills} class="{cellInput} text-right" /></td>
													<td class="px-3 py-2 border-r border-gray1 text-right text-gray2 font-bold bg-black/20">{sellable(t)}</td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" step="0.01" bind:value={t.price} class="{cellInput} text-right" /></td>
													<td class="px-3 py-2 border-r border-gray1"><input type="number" min="0" bind:value={t.estSold} class="{cellInput} text-right" /></td>
													<td class="px-3 py-2 border-r border-gray1 text-right text-gray2 font-bold bg-black/20">${money(potentialGross(t))}</td>
													<td class="px-0 py-0 text-center">
														<button type="button" on:click={() => removeTicketRow(t.id)} class="w-full h-full min-h-[40px] px-2 text-gray2 hover:text-red-500 hover:bg-red-500/10 hover:cursor-pointer transition-colors font-bold text-lg block">×</button>
													</td>
												</tr>
											{:else}
												<tr><td colspan="9" class="px-3 py-3 text-xs text-gray2 font-bold">No tiers yet.</td></tr>
											{/each}
										</tbody>
										{#if editingEvent.tickets.length > 0}
											<tfoot class="bg-navbar font-bold text-xs">
												<tr>
													<td class="px-3 py-4 text-white">Totals</td>
													<td class="px-3 py-4 text-right text-white">{editingEvent.tickets.reduce((s, t) => s + (Number(t.allotment) || 0), 0)}</td>
													<td class="px-3 py-4 text-right text-white">{editingEvent.tickets.reduce((s, t) => s + (Number(t.comps) || 0), 0)}</td>
													<td class="px-3 py-4 text-right text-white">{editingEvent.tickets.reduce((s, t) => s + (Number(t.kills) || 0), 0)}</td>
													<td class="px-3 py-4 text-right text-white">{editingEvent.tickets.reduce((s, t) => s + sellable(t), 0)}</td>
													<td></td>
													<td class="px-3 py-4 text-right text-white">{editingEvent.tickets.reduce((s, t) => s + (Number(t.estSold) || 0), 0)}</td>
													<td class="px-3 py-4 text-right text-lime">${money(editingEvent.tickets.reduce((s, t) => s + potentialGross(t), 0))}</td>
													<td></td>
												</tr>
											</tfoot>
										{/if}
									</table>
								</div>
							</div>
						{/if}
					</section>
				</div>

				<div class="flex gap-3 justify-end">
					<button
						type="button"
						on:click={() => guarded(() => (editingEvent = null))}
						class="px-6 py-2.5 bg-gray1 text-white font-bold text-sm rounded-full hover:bg-gray2/30 cursor-pointer"
						>Cancel</button
					>
					<button
						type="button"
						on:click={saveEvent}
						disabled={saving || !editingEvent.name.trim()}
						class="px-6 py-2.5 bg-lime text-black font-black text-sm rounded-full hover:opacity-90 cursor-pointer disabled:opacity-40"
					>
						{saving ? 'Saving...' : 'Save Template'}
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if deleteTarget}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
	>
		<div class="bg-navbar rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
			<div class="p-8 text-center">
				<div class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-5">
					<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"></polyline>
						<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
					</svg>
				</div>
				<h3 class="text-xl font-black text-white mb-2 tracking-wide">Delete Template</h3>
				<p class="text-gray2 text-sm font-bold leading-relaxed">
					Delete <span class="text-white">{deleteTarget.name}</span>? This cannot be undone.
				</p>
			</div>
			<div class="p-6 flex gap-3 justify-center bg-black/20">
				<button
					type="button"
					class="px-6 py-3 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer"
					on:click={() => (deleteTarget = null)}
				>
					Cancel
				</button>
				<button
					type="button"
					disabled={deleting}
					class="px-6 py-3 bg-problem text-black text-sm font-black rounded-full hover:opacity-80 transition-opacity cursor-pointer disabled:opacity-50"
					on:click={confirmDelete}
				>
					{deleting ? 'Deleting...' : 'Delete'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showLeaveModal}
	<div
		use:portal
		class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
	>
		<div class="bg-navbar rounded-3xl w-full max-w-md flex flex-col shadow-2xl overflow-hidden">
			<div class="p-8 text-center">
				<div class="w-16 h-16 bg-problem/10 rounded-full flex items-center justify-center mx-auto mb-5">
					<svg class="w-8 h-8 text-problem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
						<line x1="12" y1="9" x2="12" y2="13"></line>
						<line x1="12" y1="17" x2="12.01" y2="17"></line>
					</svg>
				</div>
				<h3 class="text-xl font-black text-white mb-2 tracking-wide">Unsaved Changes</h3>
				<p class="text-gray2 text-sm font-bold leading-relaxed">
					This template has unsaved changes. Save them before leaving?
				</p>
			</div>
			<div class="p-6 flex gap-3 justify-center bg-black/20">
				<button
					type="button"
					class="px-5 py-3 bg-gray3 text-black text-sm font-bold rounded-full hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
					on:click={() => {
						showLeaveModal = false;
						pendingAction = null;
					}}
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-5 py-3 bg-gray1 text-problem text-sm font-bold rounded-full hover:bg-problem/10 transition-colors cursor-pointer whitespace-nowrap"
					on:click={leaveAnyway}
				>
					Leave Anyway
				</button>
				<button
					type="button"
					disabled={saving}
					class="px-5 py-3 bg-lime text-black text-sm font-black rounded-full hover:opacity-80 transition-opacity cursor-pointer whitespace-nowrap disabled:opacity-50"
					on:click={leaveSaveNow}
				>
					{saving ? 'Saving...' : 'Save Now'}
				</button>
			</div>
		</div>
	</div>
{/if}
