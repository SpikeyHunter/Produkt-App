<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fly, fade } from 'svelte/transition';
	import { supabase } from '$lib/supabase';
	import dayjs from 'dayjs';
	import type { TechHistoryEntry } from '$lib/types/tech-schedule';

	export let isOpen = false;
	export let rowId: string | null = null;
	export let rowIndex: number = 0;
	// New prop for Row #
	export let field: string | null = null;
	export let rowDate: string | null = null;

	const dispatch = createEventDispatcher();
	let history: TechHistoryEntry[] = [];
	let loading = false;
	// Cache for user profiles to avoid repeated fetches
	let userCache: Record<string, string> = {};
	// Map technical field names to display names
	const COL_DISPLAY_MAP: Record<string, string> = {
		event_name: 'EVENTS',
		op_hours: 'OPS HOURS',
		crew_call: 'CREW CALL',
		ld: 'LD',
		video: 'VIDEO',
		vj: 'VJ',
		sound: 'SOUND',
		tech_sm: 'TECH',
		dt: 'DT',
		artist_liaison: 'LIAISON',
		notes: 'NOTES',
		type: 'TYPE',
		date: 'DATE'
	};
	$: if (isOpen && rowId && field) {
		fetchHistory();
	}

	function close() {
		dispatch('close');
	}

	async function fetchHistory() {
		loading = true;
		history = [];
		try {
			// 1. Fetch History
			const { data, error } = await supabase
				.from('schedule_techs_history')
				.select('*')
				.eq('row_id', rowId)
				.order('changed_at', { ascending: false });
			if (error) throw error;

			// 2. Filter for specific field changes
			const relevantHistory = (data || []).filter((h: TechHistoryEntry) => {
				const hasOld = h.old_data && Object.prototype.hasOwnProperty.call(h.old_data, field!);
				const hasNew = h.new_data && Object.prototype.hasOwnProperty.call(h.new_data, field!);
				return hasOld || hasNew;
			});
			// 3. Extract User IDs
			const userIds = [...new Set(relevantHistory.map((h) => h.changed_by))];
			// 4. Fetch User Profiles (if not in cache)
			const idsToFetch = userIds.filter((id) => !userCache[id]);
			if (idsToFetch.length > 0) {
				const { data: profiles } = await supabase
					.from('user_profiles')
					.select('id, first_name, last_name')
					.in('id', idsToFetch);
				if (profiles) {
					profiles.forEach((p) => {
						userCache[p.id] = `${p.first_name} ${p.last_name}`;
					});
				}
			}

			// 5. Enrich History
			history = relevantHistory.map((h: TechHistoryEntry) => ({
				...h,
				changer_name: userCache[h.changed_by] || 'Unknown User'
			}));
		} catch (err) {
			console.error('Error fetching history:', err);
		} finally {
			loading = false;
		}
	}

	async function restoreVersion(entry: TechHistoryEntry) {
		if (!field) return;

		// Logic Fix:
		// If we are "Restoring a version", we usually want the value represented by that version (new_data).
		// However, if the version was a "Delete/Remove", new_data is empty, so we want the old_data (Undo Delete).
		
		const newVal = entry.new_data?.[field];
		const isRemoval = newVal === null || newVal === undefined || newVal === '';

		const valueToRestore = isRemoval ? entry.old_data?.[field] : newVal;

		dispatch('restore', {
			rowId,
			field,
			value: valueToRestore,
			sourceDate: entry.changed_at
		});
	}

	function formatValue(val: any): string {
		if (val === null || val === undefined || val === '') return '(empty)';
		return String(val);
	}

	function getChangeType(entry: TechHistoryEntry): { label: string; color: string } {
		if (!field) return { label: 'UPDATE', color: 'text-question' };
		const oldVal = entry.old_data?.[field];
		const newVal = entry.new_data?.[field];
		const hasOld = oldVal !== null && oldVal !== undefined && oldVal !== '';
		const hasNew = newVal !== null && newVal !== undefined && newVal !== '';
		if (entry.action === 'RESTORE') return { label: 'RESTORED', color: 'text-info' };
		if (!hasOld && hasNew) return { label: 'ADDED', color: 'text-confirmed' };
		if (hasOld && !hasNew) return { label: 'REMOVED', color: 'text-problem' };
		return { label: 'UPDATED', color: 'text-question' };
	}
</script>

{#if isOpen}
	<div
		class="fixed inset-0 bg-black/45 z-[60]"
		role="button"
		tabindex="0"
		on:click={close}
		on:keydown={(e) => e.key === 'Escape' && close()}
		aria-label="Close History Panel"
		transition:fade={{ duration: 200 }}
	></div>

	<div
		class="fixed top-0 right-0 h-full w-[400px] bg-[#1a1a1a] shadow-2xl z-[70] flex flex-col font-mono"
		transition:fly={{ x: 400, duration: 300, opacity: 1 }}
	>
		<div
			class="p-5  bg-[#151515] flex items-start justify-between shrink-0"
		>
			<div>
				<h3 class="text-white font-bold text-base uppercase tracking-wider mb-2">Cell History</h3>
				{#if rowDate && field}
					<p class="text-[13px] text-gray2 leading-relaxed">
						<span class="text-gray2 font-bold">#{rowIndex + 1}</span>
						<span class="mx-1.5">•</span>
						{dayjs(rowDate).format('dddd MMMM D YYYY')}
						<span class="mx-1.5">•</span>
						<span class="text-gray2 font-bold">{COL_DISPLAY_MAP[field] ||
field.toUpperCase()}</span
						>
					</p>
				{/if}
			</div>

			<button
				class="text-gray2 hover:text-problem hover:cursor-pointer hover:bg-problem/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors -mr-2 -mt-2"
				on:click={close}
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"
					></line></svg
				>
			</button>
		</div>

		<div class="flex-1 overflow-y-auto p-5 custom-scrollbar">
			{#if loading}
				<div class="flex flex-col items-center justify-center h-40 text-gray2 gap-3">
					<div
						class="w-6 h-6 border-2 border-lime/30 border-t-lime rounded-full animate-spin"
					></div>
					<span class="text-xs">Loading history...</span>
				</div>
			{:else if history.length === 0}
				<div class="text-center text-gray2 py-10 italic text-sm">
					No history found for this cell.
				</div>
			{:else}
				<div class="flex flex-col gap-6 relative">
					<div class="absolute left-[5px] top-2 bottom-2 w-px bg-white/10"></div>

					{#each history as item}
						{@const changeType = getChangeType(item)}

						<div class="relative pl-6 group">
							<div
								class="absolute -left-[3px] top-1.5 w-[17px] h-[17px] rounded-full bg-[#1a1a1a] border-2 {changeType.label ===
								'REMOVED'
									? 'border-red-400'
									: 'border-gray2'} z-10"
							></div>

							<div class="flex flex-col">
								<div class="flex items-baseline justify-between mb-1.5">
									<div class="flex items-baseline gap-2">
										<span class="text-[13px] font-bold text-white">{item.changer_name}</span>
										<span class="text-[10px] uppercase tracking-wide font-bold {changeType.color}"
											>{changeType.label}</span
										>
									</div>
									<span class="text-[11px] text-gray2"
										>{dayjs(item.changed_at).format('MMM D, h:mm A')}</span
									>
								</div>

								<div
									class="bg-navbar rounded-md border-2 border-navbar p-3 flex items-center justify-between group-hover:border-white/10 transition-colors"
								>
									<div
										class="text-[13px] leading-snug break-all mr-3 flex flex-wrap items-center gap-x-2"
									>
										{#if changeType.label !== 'ADDED'}
											<span
												class="text-problem line-through decoration-problem decoration-1 "
											>
												{formatValue(item.old_data?.[field || ''])}
											</span>
										{/if}

										{#if changeType.label === 'UPDATED'}
											<span class="text-gray2 text-[10px] transform translate-y-[1px]">▶</span>
										{/if}

										{#if changeType.label !== 'REMOVED'}
											<span class="text-confirmed font-medium">
												{formatValue(item.new_data?.[field || ''])}
											</span>
										{/if}
									</div>

									{#if field && ((item.old_data && item.old_data[field] !== undefined) || (item.new_data && item.new_data[field] !== undefined))}
										<button
											class="text-gray2 hover:cursor-pointer hover:text-lime p-1.5 rounded transition-all shrink-0"
											title="Restore this version"
											aria-label="Restore this version"
											on:click={() => restoreVersion(item)}
										>
											<svg
												xmlns="http://www.w3.org/2000/svg"
												width="20"
												height="20"
												viewBox="0 0 512 512"
												fill="currentColor"
											>
												<path
													d="M75 75L41 41v128h128l-51-51c37-37 88-60 145-60 114 0 207 93 207 207s-93 207-207 207c-82 0-153-48-186-117l-45 17c40 84 126 142 231 142 137 0 249-112 249-249S400 16 263 16c-69 0-131 28-176 73z"
												/>
												<path
													d="M263 116c-13 0-24 11-24 24v100l69 41c11 7 26 3 33-8s3-26-8-33l-46-28V140c0-13-11-24-24-24z"
												/>
											</svg>
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 6px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(255, 255, 255, 0.2);
	}
</style>