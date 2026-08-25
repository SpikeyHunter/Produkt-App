<script lang="ts">
	import { tick } from 'svelte';
	import { supabase } from '$lib/supabase';

	// Global CMD+K search. Currently searches the generated documents in the
	// storage bucket: offers/ and settlements/. Typing "offer" lists every
	// offer; extra words narrow by artist, date or version. Enter / click opens
	// the document's pretty link in a new tab.

	interface PaletteItem {
		kind: 'Offer' | 'Settlement' | 'Hold';
		dateDisplay: string;
		dateSort: number;
		artist: string;
		tag: string;
		url: string;
		haystack: string;
	}

	let open = false;
	let query = '';
	let items: PaletteItem[] = [];
	let loading = false;
	let sel = 0;
	let inputEl: HTMLInputElement;
	let listEl: HTMLDivElement;

	function parseFileDate(raw: string): { display: string; sort: number } {
		// "08-Sep-2026"
		const d = new Date(raw.replace(/-/g, ' '));
		if (isNaN(d.getTime())) return { display: raw, sort: 0 };
		return {
			display: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
			sort: d.getTime()
		};
	}

	function itemFor(name: string): PaletteItem | null {
		let m = name.match(/^(\d{2}-[A-Za-z]{3}-\d{4})_(.+)_Offer_(\d+)\.pdf$/i);
		if (m) {
			const { display, sort } = parseFileDate(m[1]);
			const artist = m[2].replace(/-/g, ' ');
			const tag = `Version ${m[3]}`;
			return {
				kind: 'Offer',
				dateDisplay: display,
				dateSort: sort,
				artist,
				tag,
				url: `/offer/${encodeURIComponent(m[2])}/${m[3]}`,
				haystack: `offer ${display} ${m[1]} ${artist} version ${m[3]} offer ${m[3]}`.toLowerCase()
			};
		}
		m = name.match(/^(\d{2}-[A-Za-z]{3}-\d{4})_(.+)_(Ext|Int)_Settlement\.pdf$/i);
		if (m) {
			const { display, sort } = parseFileDate(m[1]);
			const artist = m[2].replace(/-/g, ' ');
			const external = m[3].toLowerCase() === 'ext';
			return {
				kind: 'Settlement',
				dateDisplay: display,
				dateSort: sort,
				artist,
				tag: external ? 'External' : 'Internal',
				url: `/settlement/${encodeURIComponent(m[2])}/${external ? 'Ext' : 'Int'}`,
				haystack: `settlement ${display} ${m[1]} ${artist} ${external ? 'external ext' : 'internal int'}`.toLowerCase()
			};
		}
		return null;
	}

	async function loadFiles() {
		loading = true;
		try {
			const [o, se, undef] = await Promise.all([
				supabase.storage.from('documents').list('offers', { limit: 1000 }),
				supabase.storage.from('documents').list('settlements', { limit: 1000 }),
				supabase
					.from('calendar_events')
					.select('id, short_id, status, calendar(title)')
					.is('date', null)
			]);
			const names = [...(o.data || []), ...(se.data || [])].map((f) => f.name);
			// Undefined holds (Date Bypass events): searchable by title / "hold" / "undefined".
			const holdItems: PaletteItem[] = ((undef.data as any[]) || [])
				.filter((r) => r.status === 'HOLD')
				.map((r) => {
					const cal = Array.isArray(r.calendar) ? r.calendar[0] : r.calendar;
					const title = cal?.title || '(No Title)';
					return {
						kind: 'Hold' as const,
						dateDisplay: 'No date',
						dateSort: 0,
						artist: title,
						tag: 'Undefined',
						url: `/calendar/${r.short_id || r.id}`,
						haystack: `hold undefined event no date ${title}`.toLowerCase()
					};
				});
			items = [
				...names.map(itemFor).filter((x): x is PaletteItem => x !== null),
				...holdItems
			].sort((a, b) => b.dateSort - a.dateSort || a.artist.localeCompare(b.artist));
		} catch (err) {
			console.error('❌ [cmdk] Failed to list documents:', err);
			items = [];
		} finally {
			loading = false;
		}
	}

	async function openPalette() {
		open = true;
		query = '';
		sel = 0;
		loadFiles(); // refresh every open — the bucket may have changed
		await tick();
		inputEl?.focus();
	}

	function closePalette() {
		open = false;
	}

	$: results = (() => {
		const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return [];
		return items.filter((it) => tokens.every((t) => it.haystack.includes(t)));
	})();

	$: if (results && sel >= results.length) sel = Math.max(0, results.length - 1);

	function openItem(it: PaletteItem) {
		window.open(it.url, '_blank', 'noopener');
		closePalette();
	}

	function onWindowKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
			e.preventDefault();
			open ? closePalette() : openPalette();
			return;
		}
		if (!open) return;
		if (e.key === 'Escape') {
			e.preventDefault();
			closePalette();
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			sel = Math.min(sel + 1, results.length - 1);
			scrollSelIntoView();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			sel = Math.max(sel - 1, 0);
			scrollSelIntoView();
		} else if (e.key === 'Enter') {
			e.preventDefault();
			if (results[sel]) openItem(results[sel]);
		}
	}

	function scrollSelIntoView() {
		tick().then(() =>
			listEl?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: 'nearest' })
		);
	}
</script>

<svelte:window on:keydown={onWindowKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex justify-center items-start pt-[12vh] p-4"
		on:click|self={closePalette}
		role="none"
	>
		<div class="bg-navbar border border-gray2/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[62vh]">
			<div class="flex items-center gap-3 px-5 py-4 border-b border-gray1">
				<svg class="w-5 h-5 text-gray2 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
				<input
					bind:this={inputEl}
					bind:value={query}
					on:input={() => (sel = 0)}
					type="text"
					placeholder={'Type "offer" or "settlement", then artist / date / version...'}
					class="flex-1 bg-transparent text-white text-sm font-bold placeholder-gray2 focus:outline-none"
				/>
				<span class="text-[10px] font-black uppercase tracking-widest text-gray2 bg-gray1 rounded-md px-1.5 py-0.5 shrink-0">Esc</span>
			</div>

			<div class="flex-1 overflow-y-auto custom-scrollbar" bind:this={listEl}>
				{#if loading && query.trim()}
					<p class="text-gray2 text-sm font-bold px-5 py-6 text-center">Loading documents...</p>
				{:else if !query.trim()}
					<p class="text-gray2 text-xs font-bold px-5 py-6 text-center leading-relaxed">
						Search the generated documents —<br />
						try <span class="text-white">offer</span>, <span class="text-white">settlement</span>,
						an artist name or a date.
					</p>
				{:else if results.length === 0}
					<p class="text-gray2 text-sm font-bold px-5 py-6 text-center">No matches.</p>
				{:else}
					<div class="py-1.5">
						{#each results as it, i (it.url + it.tag)}
							<button
								type="button"
								data-selected={i === sel}
								on:click={() => openItem(it)}
								on:mousemove={() => (sel = i)}
								class="w-full flex items-center gap-3 px-5 py-2.5 text-left cursor-pointer {i === sel
									? 'bg-gray1'
									: ''}"
							>
								<span class="w-8 h-8 rounded-lg bg-gray1 flex items-center justify-center shrink-0 {i === sel ? 'bg-navbar' : ''}">
									<svg class="w-4 h-4 text-lime" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
								</span>
								<span class="flex-1 min-w-0 text-sm font-bold text-white truncate">
									{it.kind}
									<span class="text-gray2 font-bold"> — {it.dateDisplay} — </span>{it.artist}
								</span>
								<span class="text-[10px] font-black uppercase tracking-widest bg-lime/10 text-lime rounded-full px-2.5 py-1 shrink-0">
									{it.tag}
								</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>

			<div class="px-5 py-2.5 border-t border-gray1 flex items-center gap-4 text-[10px] font-bold text-gray2">
				<span><span class="text-white">↑↓</span> navigate</span>
				<span><span class="text-white">↵</span> open in new tab</span>
				{#if query.trim() && results.length}
					<span class="ml-auto">{results.length} result{results.length === 1 ? '' : 's'}</span>
				{/if}
			</div>
		</div>
	</div>
{/if}
