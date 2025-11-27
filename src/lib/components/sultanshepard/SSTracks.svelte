<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { updateSSShow, type SSShow } from '$lib/services/ssShowService';
	import ClipboardButton from '$lib/components/buttons/ClipboardButton.svelte';

	export let show: SSShow;
	const dispatch = createEventDispatcher();

	// Default autoFormat to true
	let tracklist = show.tracklist || { revised: 'no', sent: 'no', text: '', autoFormat: true };

	// Colors
	const cYes = 'bg-[#86EFAC] text-black border-[#86EFAC] hover:opacity-90'; // Green
	const cProg = 'bg-[#FDBA74] text-black border-[#FDBA74] hover:opacity-90'; // Orange
	const cNo = 'bg-[#FCA5A5] text-black border-[#FCA5A5] hover:opacity-90'; // Red
	const cOff = 'bg-transparent text-gray2 border-gray2 hover:border-white hover:text-white';

	async function save() {
		if (tracklist.autoFormat) {
			formatText();
		}
		await updateSSShow(show.id, { tracklist });
		dispatch('update', { updates: { tracklist } });
	}

	function formatText() {
		if (!tracklist.text) return;

		const lines = tracklist.text.split('\n');
		const formatted = lines
			.map((line: string) => {
				// Remove existing dashes or bullets and trim
				let clean = line.replace(/^[-*•]\s*/, '').trim();
				if (!clean) return '';

				// Sentence Case: First letter upper, rest lower
				clean = clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();

				return `- ${clean}`;
			})
			.filter(Boolean)
			.join('\n');

		tracklist.text = formatted;
	}

	function toggleRevised() {
		const options = ['no', 'inprogress', 'yes'];
		const currentIdx = options.indexOf(tracklist.revised || 'no');
		tracklist.revised = options[(currentIdx + 1) % options.length];
		save();
	}

	function toggleSent() {
		tracklist.sent = tracklist.sent === 'yes' ? 'no' : 'yes';
		save();
	}

	function getRevisedColor(status: string) {
		if (status === 'yes') return cYes;
		if (status === 'inprogress') return cProg;
		return cNo;
	}

	function getRevisedText(status: string) {
		if (status === 'yes') return 'Yes';
		if (status === 'inprogress') return 'In Progress';
		return 'No';
	}

	// --- Clipboard Content ---
	$: clipboardText = `Tracklist:\n${tracklist.text}`;

	$: clipboardHtml = `
        <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px;">
            <strong style="text-decoration: underline;">Tracklist:</strong><br>
            ${tracklist.text ? tracklist.text.split('\n').join('<br>') : ''}
        </div>
    `;
</script>

<div class="bg-navbar rounded-2xl overflow-hidden h-full flex flex-col">
	<div class="px-5 py-4 border-b border-gray1 flex justify-between items-center flex-shrink-0">
		<h3 class="text-lg font-bold text-white">Tracklist</h3>

        {#if tracklist.text && tracklist.text.trim().length > 0}
            <ClipboardButton
                variant="text"
                label="Copy Tracklist"
                copyText={clipboardText}
                copyHtml={clipboardHtml}
                successMessage="Copied!"
            />
        {/if}
    </div>

	<div class="p-5 space-y-5 flex-1 flex flex-col min-h-0">
		<div class="space-y-4 flex-shrink-0">
			<div class="flex justify-between items-center">
				<span class="text-sm text-white font-medium">Revised</span>
				<button
					class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center font-bold min-w-[50px] {getRevisedColor(
						tracklist.revised
					)}"
					on:click={toggleRevised}
				>
					{getRevisedText(tracklist.revised)}
				</button>
			</div>

			<div class="flex justify-between items-center">
				<span class="text-sm text-white font-medium">Sent to VJ</span>
				<button
					class="rounded-2xl px-3 py-1 text-xs transition-colors duration-200 cursor-pointer flex items-center justify-center font-bold min-w-[50px] {tracklist.sent ===
					'yes'
						? cYes
						: cNo}"
					on:click={toggleSent}
				>
					{tracklist.sent === 'yes' ? 'Yes' : 'No'}
				</button>
			</div>
		</div>

		<hr class="border-gray1 flex-shrink-0" />

		<div class="flex-1 flex flex-col min-h-0">
			<div class="flex justify-between items-center mb-2 flex-shrink-0">
				<label for="tracklist-area-{show.id}" class="text-xs text-gray2 font-bold uppercase"
					>Tracklist</label
				>

				<button
					type="button"
					class="flex items-center gap-2 cursor-pointer group bg-transparent border-none p-0"
					on:click={() => {
						tracklist.autoFormat = !tracklist.autoFormat;
						save();
					}}
					aria-label="Toggle auto-format"
				>
					<span
						class="text-[10px] text-gray2 font-bold uppercase group-hover:text-white transition-colors"
						>Auto-Format</span
					>

					<div
						class="w-8 h-4 rounded-full transition-colors relative border {tracklist.autoFormat
							? 'border-lime bg-transparent'
							: 'border-gray1 bg-gray1'}"
					>
						<div
							class="w-3 h-3 rounded-full absolute top-[1px] transition-all {tracklist.autoFormat
								? 'left-4 bg-lime'
								: 'left-0.5 bg-white'}"
						></div>
					</div>
				</button>
			</div>

			<textarea
				id="tracklist-area-{show.id}"
				class="flex-1 w-full bg-gray1 rounded-xl p-3 text-sm text-gray2 focus:outline-none focus:ring-1 focus:ring-lime resize-none border-none custom-scrollbar leading-relaxed font-mono"
				placeholder="Paste track list here..."
				bind:value={tracklist.text}
				on:blur={save}
			></textarea>
		</div>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #444;
		border-radius: 2px;
	}
</style>
