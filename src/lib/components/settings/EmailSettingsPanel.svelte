<script lang="ts">
	// Settings > General > Emails: subjects, CC/BCC, auto-attached people,
	// crew-call defaults, lights colours/rows and lounge options for the
	// Email Tech page.
	import { onMount, createEventDispatcher } from 'svelte';
	import {
		loadEmailSettings,
		saveEmailSettings,
		normalizeEmailSettings,
		DEFAULT_EMAIL_SETTINGS,
		SUBJECT_TOKENS,
		type EmailSettings
	} from '$lib/services/emailSettingsService';

	let draft: EmailSettings = JSON.parse(JSON.stringify(DEFAULT_EMAIL_SETTINGS));
	let loading = true;
	let saving = false;
	let savedAt = 0;
	let error = '';
	let tab: 'emails' | 'crew' | 'lights' | 'lounge' | 'specs' = 'emails';
	/** inside the Email Tech modal */
	export let compact = false;
	const dispatch = createEventDispatcher<{ saved: void }>();

	// Lists are edited as comma/newline separated text.
	let techCc = '';
	let techBcc = '';
	let vjCc = '';
	let vjBcc = '';
	let loungeBackSide = '';
	let loungeBack = '';
	let loungeLounge = '';

	onMount(async () => {
		const s = await loadEmailSettings(true);
		draft = JSON.parse(JSON.stringify(s));
		techCc = s.tech.cc.join(', ');
		techBcc = s.tech.bcc.join(', ');
		vjCc = s.vj.cc.join(', ');
		vjBcc = s.vj.bcc.join(', ');
		loungeBackSide = s.lounge.backSide.join('\n');
		loungeBack = s.lounge.back.join('\n');
		loungeLounge = s.lounge.lounge.join('\n');
		loading = false;
	});

	const list = (v: string) => v.split(/[,\n;]/).map((x) => x.trim()).filter(Boolean);

	async function save() {
		saving = true;
		error = '';
		const next = normalizeEmailSettings({
			...draft,
			tech: { ...draft.tech, cc: list(techCc), bcc: list(techBcc) },
			vj: { ...draft.vj, cc: list(vjCc), bcc: list(vjBcc) },
			lounge: { backSide: list(loungeBackSide), back: list(loungeBack), lounge: list(loungeLounge) }
		});
		const ok = await saveEmailSettings(next);
		saving = false;
		if (ok) {
			draft = JSON.parse(JSON.stringify(next));
			savedAt = Date.now();
			dispatch('saved');
		} else error = 'Could not save. Check the console.';
	}

	function resetDefaults() {
		const d = JSON.parse(JSON.stringify(DEFAULT_EMAIL_SETTINGS)) as EmailSettings;
		draft = d;
		techCc = d.tech.cc.join(', ');
		techBcc = d.tech.bcc.join(', ');
		vjCc = d.vj.cc.join(', ');
		vjBcc = d.vj.bcc.join(', ');
		loungeBackSide = d.lounge.backSide.join('\n');
		loungeBack = d.lounge.back.join('\n');
		loungeLounge = d.lounge.lounge.join('\n');
	}

	function addSpec() {
		draft.specs = [...draft.specs, { label: '', url: '', color: '#9ca3af' }];
	}
	function removeSpec(i: number) {
		draft.specs = draft.specs.filter((_, k) => k !== i);
	}
	function moveSpec(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= draft.specs.length) return;
		const list = [...draft.specs];
		[list[i], list[j]] = [list[j], list[i]];
		draft.specs = list;
	}

	function addColor() {
		draft.lights.colors = [...draft.lights.colors, { label: '', hex: '#ffffff' }];
	}
	function removeColor(i: number) {
		draft.lights.colors = draft.lights.colors.filter((_, k) => k !== i);
	}
	function addRow() {
		draft.lights.rows = [...draft.lights.rows, { label: '', timeOptions: [], mode: 'single', allowBazart: true }];
	}
	function removeRow(i: number) {
		draft.lights.rows = draft.lights.rows.filter((_, k) => k !== i);
	}
	function moveRow(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= draft.lights.rows.length) return;
		const rows = [...draft.lights.rows];
		[rows[i], rows[j]] = [rows[j], rows[i]];
		draft.lights.rows = rows;
	}

	const input =
		'bg-black/50 border border-gray2/30 text-white rounded-2xl px-4 py-2.5 text-sm w-full focus:outline-none focus:border-lime transition-colors placeholder-gray2/50';
	const label = 'text-gray2 text-xs font-bold uppercase tracking-wider';
</script>

{#if loading}
	<div class="h-12 flex items-center text-gray2 text-sm animate-pulse">Loading…</div>
{:else}
	<div class="flex gap-1 bg-gray1 p-1 rounded-xl w-fit mb-5">
		{#each [['emails', 'Emails'], ['crew', 'Crew Call'], ['specs', 'Stage Specs'], ['lights', 'Lights'], ['lounge', 'Lounge']] as [id, name]}
			<button type="button" on:click={() => (tab = id as typeof tab)}
				class="px-3 text-xs font-bold py-1.5 rounded-lg transition-all cursor-pointer {tab === id ? 'bg-lime text-black' : 'text-gray-400 hover:text-white'}">{name}</button>
		{/each}
	</div>

	{#if tab === 'emails'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="space-y-3">
				<h3 class="text-white font-bold text-sm">Tech email</h3>
				<div><span class={label}>Subject</span><input class={input} bind:value={draft.tech.subject} /></div>
				<div><span class={label}>CC</span><input class={input} bind:value={techCc} placeholder="a@x.com, b@y.com" /></div>
				<div><span class={label}>BCC</span><input class={input} bind:value={techBcc} placeholder="optional" /></div>
			</div>
			<div class="space-y-3">
				<h3 class="text-white font-bold text-sm">VJ email</h3>
				<div><span class={label}>Subject</span><input class={input} bind:value={draft.vj.subject} /></div>
				<div><span class={label}>CC</span><input class={input} bind:value={vjCc} /></div>
				<div><span class={label}>BCC</span><input class={input} bind:value={vjBcc} placeholder="optional" /></div>
			</div>
		</div>

		<div class="mt-4 bg-black/20 border border-gray2/10 rounded-2xl p-4">
			<div class="{label} mb-2">Subject fields</div>
			<div class="flex flex-wrap gap-2">
				{#each SUBJECT_TOKENS as t}
					<span class="text-xs px-2 py-1 rounded-full bg-gray1 text-white font-mono" title={t.help}>{t.token}</span>
				{/each}
			</div>
			<p class="text-gray2 text-xs mt-2">e.g. <span class="font-mono text-white">{'{events} | Set times + tech riders > {date}'}</span></p>
		</div>

		<div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" bind:checked={draft.autoPeople.crewTo} class="accent-lime w-4 h-4" />
				<span class="text-sm text-white">Assigned crew → <span class="text-gray2">To</span></span>
			</label>
			<label class="flex items-center gap-3 cursor-pointer">
				<input type="checkbox" bind:checked={draft.autoPeople.liaisonCc} class="accent-lime w-4 h-4" />
				<span class="text-sm text-white">Liaison (advance DOS) → <span class="text-gray2">Cc</span></span>
			</label>
			<div class="flex items-center gap-3">
				<span class="text-sm text-white">Default format</span>
				<div class="flex gap-1 bg-gray1 p-0.5 rounded-lg">
					<button type="button" on:click={() => (draft.format = 'html')} class="px-2.5 text-[10px] font-bold py-1 rounded-md cursor-pointer {draft.format === 'html' ? 'bg-lime text-black' : 'text-gray-400'}">HTML</button>
					<button type="button" on:click={() => (draft.format = 'text')} class="px-2.5 text-[10px] font-bold py-1 rounded-md cursor-pointer {draft.format === 'text' ? 'bg-lime text-black' : 'text-gray-400'}">Text</button>
				</div>
			</div>
		</div>
	{:else if tab === 'crew'}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div><span class={label}>Default tech call</span><input type="time" class={input} bind:value={draft.crewCall.techTime} style="color-scheme: dark;" /></div>
			<div><span class={label}>Default VJ call</span><input type="time" class={input} bind:value={draft.crewCall.vjTime} style="color-scheme: dark;" /></div>
			<div><span class={label}>Minutes before soundcheck</span><input type="number" min="0" step="15" class={input} bind:value={draft.crewCall.soundcheckOffsetMin} /></div>
		</div>
		<label class="flex items-center gap-3 cursor-pointer mt-4">
			<input type="checkbox" bind:checked={draft.crewCall.useSoundcheck} class="accent-lime w-4 h-4" />
			<span class="text-sm text-white">When a soundcheck is booked, crew call = soundcheck start − {draft.crewCall.soundcheckOffsetMin} min
				<span class="text-gray2">(6:30 PM soundcheck → 5:30 PM call)</span></span>
		</label>
	{:else if tab === 'specs'}
		<div class="flex items-center justify-between mb-2">
			<h3 class="text-white font-bold text-sm">Stage specs</h3>
			<button type="button" on:click={addSpec} class="text-lime text-xs font-bold hover:underline cursor-pointer">+ Add</button>
		</div>
		<div class="space-y-2">
			{#each draft.specs as sp, i}
				<div class="flex items-center gap-2">
					<input type="color" bind:value={sp.color} class="w-9 h-9 shrink-0 rounded-lg bg-transparent border border-gray2/30 cursor-pointer" aria-label="Colour" />
					<input class="{input} md:!w-56" bind:value={sp.label} placeholder="Name (e.g. Main Stage #1)" />
					<input class="{input} font-mono !text-xs" bind:value={sp.url} placeholder="https://link.produkt.ca/…" />
					<button type="button" on:click={() => moveSpec(i, -1)} class="text-gray2 hover:text-white cursor-pointer px-1" aria-label="Move up">↑</button>
					<button type="button" on:click={() => moveSpec(i, 1)} class="text-gray2 hover:text-white cursor-pointer px-1" aria-label="Move down">↓</button>
					<button type="button" on:click={() => removeSpec(i)} class="text-gray2 hover:text-problem cursor-pointer p-1" aria-label="Remove spec">✕</button>
				</div>
			{/each}
		</div>
		<p class="text-gray2 text-xs mt-2">“Other” is always offered in the section and lets you type a name + link.</p>
	{:else if tab === 'lights'}
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div>
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-white font-bold text-sm">Colours</h3>
					<button type="button" on:click={addColor} class="text-lime text-xs font-bold hover:underline cursor-pointer">+ Add</button>
				</div>
				<div class="space-y-2">
					{#each draft.lights.colors as c, i}
						<div class="flex items-center gap-2">
							<input type="color" bind:value={c.hex} class="w-9 h-9 rounded-lg bg-transparent border border-gray2/30 cursor-pointer" aria-label="Swatch" />
							<input class={input} bind:value={c.label} placeholder="Name" />
							<input class="{input} !w-28 font-mono" bind:value={c.hex} />
							<button type="button" on:click={() => removeColor(i)} class="text-gray2 hover:text-problem cursor-pointer p-1" aria-label="Remove colour">✕</button>
						</div>
					{/each}
				</div>
			</div>
			<div>
				<div class="flex items-center justify-between mb-2">
					<h3 class="text-white font-bold text-sm">Rows</h3>
					<button type="button" on:click={addRow} class="text-lime text-xs font-bold hover:underline cursor-pointer">+ Add</button>
				</div>
				<div class="space-y-2">
					{#each draft.lights.rows as r, i}
						<div class="bg-black/20 border border-gray2/10 rounded-2xl p-3 space-y-2">
							<div class="flex items-center gap-2">
								<input class={input} bind:value={r.label} placeholder="Area (e.g. Lounge)" />
								<select bind:value={r.mode} class="bg-black/50 border border-gray2/30 text-white rounded-2xl px-3 py-2.5 text-xs focus:outline-none focus:border-lime">
									<option value="single">1 colour</option>
									<option value="dual">2 colours</option>
									<option value="dynamic">2 when time has “&”</option>
									<option value="fixed_single">1 colour, no time</option>
								</select>
								<button type="button" on:click={() => moveRow(i, -1)} class="text-gray2 hover:text-white cursor-pointer px-1" aria-label="Move up">↑</button>
								<button type="button" on:click={() => moveRow(i, 1)} class="text-gray2 hover:text-white cursor-pointer px-1" aria-label="Move down">↓</button>
								<button type="button" on:click={() => removeRow(i)} class="text-gray2 hover:text-problem cursor-pointer p-1" aria-label="Remove row">✕</button>
							</div>
							<div class="flex items-center gap-3">
								<input class={input} value={r.timeOptions.join(', ')} on:change={(e) => (r.timeOptions = list(e.currentTarget.value))} placeholder="Time options, comma separated (5PM-3AM, 5PM & 10PM)" />
								<label class="flex items-center gap-2 text-xs text-gray2 whitespace-nowrap cursor-pointer">
									<input type="checkbox" bind:checked={r.allowBazart} class="accent-lime" /> Bazart colours
								</label>
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div><span class={label}>Both terrasses</span><textarea rows="5" class="{input} resize-none" bind:value={loungeBackSide} placeholder="One option per line"></textarea></div>
			<div><span class={label}>Back terrasse</span><textarea rows="5" class="{input} resize-none" bind:value={loungeBack}></textarea></div>
			<div><span class={label}>Lounge</span><textarea rows="5" class="{input} resize-none" bind:value={loungeLounge}></textarea></div>
		</div>
		<p class="text-gray2 text-xs mt-2">“Other” is always offered and opens a free-text field.</p>
	{/if}

	<div class="flex items-center gap-3 mt-6 {compact ? 'justify-end' : ''}">
		<button type="button" on:click={resetDefaults} class="text-gray2 hover:text-white text-xs font-bold cursor-pointer">Reset to defaults</button>
		{#if error}<span class="text-problem text-xs">{error}</span>
		{:else if savedAt && !compact}<span class="text-confirmed text-xs">Saved</span>{/if}
		<button type="button" on:click={save} disabled={saving}
			class="bg-lime text-black font-bold py-2.5 px-6 rounded-3xl cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 {compact ? 'order-last' : 'order-first'}">
			{saving ? 'Saving…' : compact ? 'Save & close' : 'Save email settings'}
		</button>
	</div>
{/if}
