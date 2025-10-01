<script lang="ts">
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';
	import { authStore, type ReminderItem } from '$lib/stores/authStore';
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { tick } from 'svelte';

	let reminders: (ReminderItem & { el?: HTMLDivElement })[] = [];
	let deletingId: string | null = null;
	let saveTimer: ReturnType<typeof setTimeout>;
	let isInitialized = false;

	// Load reminders once from store
	$: if ($authStore.isInitialized && $authStore.profile?.user_reminders && !isInitialized) {
		reminders = JSON.parse(JSON.stringify($authStore.profile.user_reminders));
		normalizeReminders();
		isInitialized = true;
	}

	function generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	function normalizeReminders() {
		// Remove duplicates (same text + empty)
		const seen = new Set<string>();
		reminders = reminders.filter(r => {
			const key = r.text.trim();
			if (!key && seen.has('')) return false;
			if (seen.has(key)) return false;
			seen.add(key);
			return true;
		});

		// Ensure at least one empty at the end
		if (reminders.length === 0 || reminders[reminders.length - 1].text.trim() !== '') {
			reminders.push({ id: generateId(), text: '' });
		}
	}

	function scheduleSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			const toSave = reminders.filter(r => r.text.trim() !== '');
			authStore.updateReminders(toSave);
			normalizeReminders();
		}, 800);
	}

	function deleteReminder(id: string) {
		deletingId = id;
		setTimeout(() => {
			reminders = reminders.filter(r => r.id !== id);
			normalizeReminders();
			authStore.updateReminders(reminders.filter(r => r.text.trim() !== ''));
			deletingId = null;
		}, 200);
	}

	function handleInput(event: Event, id: string) {
		const el = event.target as HTMLDivElement;
		const reminder = reminders.find(r => r.id === id);
		if (reminder) {
			reminder.text = el.textContent || '';
			normalizeReminders();
			scheduleSave();
		}
	}

	function handleKeyDown(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter') {
			event.preventDefault();
			const idx = reminders.findIndex(r => r.id === id);
			reminders.splice(idx + 1, 0, { id: generateId(), text: '' });
			normalizeReminders();
			scheduleSave();

			tick().then(() => {
				const el = document.querySelector(`[data-reminder-id="${reminders[idx + 1].id}"]`) as HTMLElement;
				if (el) el.focus();
			});
		} else if (event.key === 'Backspace') {
			const el = event.target as HTMLDivElement;
			if (el.textContent === '') {
				event.preventDefault();
				const idx = reminders.findIndex(r => r.id === id);

				// Allow deletion of last item (reset instead)
				if (reminders.length > 1) {
					reminders.splice(idx, 1);
				} else {
					reminders[0].text = '';
				}
				normalizeReminders();
				scheduleSave();

				tick().then(() => {
					const prevIdx = Math.max(0, idx - 1);
					const prevId = reminders[prevIdx]?.id;
					if (prevId) {
						const prevEl = document.querySelector(`[data-reminder-id="${prevId}"]`) as HTMLElement;
						if (prevEl) {
							prevEl.focus();
							const range = document.createRange();
							const sel = window.getSelection();
							range.selectNodeContents(prevEl);
							range.collapse(false);
							sel?.removeAllRanges();
							sel?.addRange(range);
						}
					}
				});
			}
		}
	}

	function handleCheckClick(id: string) {
		deleteReminder(id);
	}
	function handleCheckKeyDown(event: KeyboardEvent, id: string) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			deleteReminder(id);
		}
	}

	// Initialize empty reminder
	$: if ($authStore.isInitialized && reminders.length === 0) {
		reminders = [{ id: generateId(), text: '' }];
	}

	// After reminders are initialized, inject saved text back into contenteditable divs
	$: if (isInitialized) {
		tick().then(() => {
			for (const r of reminders) {
				if (r.el) {
					// Only update if div is empty but reminder has text
					if (!r.el.textContent && r.text) {
						r.el.textContent = r.text;
					}
				}
			}
		});
	}
</script>

<DashboardTemplate title="Reminders" width={250} height={500}>
	<div class="h-full bg-navbar flex flex-col overflow-hidden">
		<div class="flex-1 overflow-y-auto overflow-x-hidden px-1 py-3">
			{#if !$authStore.isInitialized}
				<div class="flex items-center justify-center h-full text-gray-400 text-sm">
					Loading...
				</div>
			{:else}
				<ul class="space-y-2">
					{#each reminders as reminder (reminder.id)}
						<li 
							animate:flip={{ duration: 200 }}
							transition:fade={{ duration: 150 }}
							class="flex items-start gap-2.5 group"
						>
							<button
								type="button"
								on:click={() => handleCheckClick(reminder.id)}
								on:keydown={(e) => handleCheckKeyDown(e, reminder.id)}
								class="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all duration-200
									{deletingId === reminder.id 
										? 'bg-lime border-lime' 
										: 'border-gray-500 hover:border-lime'
									}
									flex items-center justify-center"
								aria-label="Complete reminder"
							>
								{#if deletingId === reminder.id}
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#121212" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12" />
									</svg>
								{/if}
							</button>
							
							<div
								contenteditable="true"
								role="textbox"
								tabindex="0"
								data-reminder-id={reminder.id}
								on:input={(e) => handleInput(e, reminder.id)}
								on:keydown={(e) => handleKeyDown(e, reminder.id)}
								class="flex-1 text-gray3 text-sm leading-relaxed outline-none 
									group-hover:text-lime transition-colors duration-200
									break-words whitespace-pre-wrap
									empty:before:content-[attr(data-placeholder)] empty:before:text-gray-600
									max-w-[170px]"
								data-placeholder="Type here..."
								bind:this={reminder.el}
							></div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</DashboardTemplate>

<style>
	[contenteditable]:focus {
		outline: none;
	}
	[contenteditable]:empty:before {
		content: attr(data-placeholder);
		color: #666;
	}
</style>
