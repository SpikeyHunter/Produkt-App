<script lang="ts">
	import { portal } from '$lib/utils/portalUtils';
	import { supabase } from '$lib/supabase';
	import { createEventDispatcher } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	export let isOpen = false;
	export let updates: any[] = [];
	export let userProfile: any = null;

	const dispatch = createEventDispatcher();
	let isConfirming = false;

	async function confirmSeen() {
		if (!updates || updates.length === 0 || !userProfile || isConfirming) return;
		isConfirming = true;

		try {
			// Mark all stacked updates as seen via the RPC
			for (const update of updates) {
				await supabase.rpc('mark_update_seen', {
					target_update_id: update.id,
					target_user_id: userProfile.id
				});
			}
		} catch (error) {
			console.error("Failed to mark updates as seen:", error);
		}

		isConfirming = false;
		isOpen = false;
		dispatch('confirmed');
	}
</script>

{#if isOpen && updates.length > 0}
	<div use:portal>
		<div 
			transition:fade={{ duration: 250 }} 
			class="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
		>
			
			<div 
				transition:fly={{ y: 40, duration: 400, opacity: 0 }}
				class="bg-navbar w-full max-w-3xl rounded-3xl shadow-3xl overflow-hidden flex flex-col max-h-[75vh]"
			>
				
				<div class="px-8 py-6  bg-black/30 from-lime/5 to-transparent flex justify-between items-start shrink-0">
					<div>
						<h2 class="text-2xl font-bold text-white uppercase tracking-wider">App Updates</h2>
						<div class="text-sm font-medium text-lime mt-1">
							( {updates.length}x new updates )
						</div>
					</div>
					<img 
						src="https://vngekjtqbdnfeombtjnx.supabase.co/storage/v1/object/public/public-assets/calendar/logos/ProduktXX_LOGO_lockup_BLANC.png" 
						alt="Produkt Logo" 
						class="h-14 object-contain" 
					/>
				</div>

				<div class="px-8 py-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
					{#each updates as update, idx}
						<div class="relative {idx !== updates.length - 1 ? 'pb-3' : ''}">
							
							<div class="mb-4">
								<div class="text-lime font-bold mb-1 tracking-wider text-xl uppercase">{update.version}</div>
								<h3 class="text-xs font-bold text-white leading-tight uppercase tracking-wide">{update.title}</h3>
							</div>

							<div class="space-y-4">
								{#each update.content as section}
									{#if section.title || (section.items && section.items.length > 0)}
										<div class="bg-black/20 p-5 rounded-2xl ">
											{#if section.title}
												<h4 class="text-base font-bold text-white mb-3 flex items-center gap-2 uppercase tracking-wide">
													<div class="w-1.5 h-4 bg-lime rounded-full"></div>
													{section.title}
												</h4>
											{/if}
											
											{#if section.items && section.items.length > 0}
												<ul class="space-y-2.5">
													{#each section.items as item}
														<li class="flex items-start gap-3 text-gray2 leading-relaxed text-sm">
															<svg class="w-4 h-4 text-lime shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
																<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
															</svg>
															<span class="text-lime/90 font-medium">{item}</span>
														</li>
													{/each}
												</ul>
											{/if}
										</div>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<div class="px-8 py-5 border-t border-gray1/30 flex justify-end bg-navbar shrink-0">
					<button 
						on:click={confirmSeen} 
						disabled={isConfirming}
						class="bg-lime text-black font-bold py-2.5 px-8 text-md rounded-full hover:opacity-90 disabled:opacity-50 transition-all transform hover:scale-105 cursor-pointer"
					>
						{isConfirming ? 'Cool!' : 'Nice!'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(204, 255, 0, 0.5); 
	}
</style>