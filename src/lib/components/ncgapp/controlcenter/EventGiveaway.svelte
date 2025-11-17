<script lang="ts">
	// Placeholder component for Event Giveaway
	// Will be implemented in the future with similar functionality to announcements
</script>

<div class="h-full flex flex-col bg-navbar border-2 border-gray1 rounded-xl overflow-hidden">
	<div class="p-3 border-b border-gray1 flex-shrink-0">
		<div class="flex items-center justify-between mb-2">
			<h3 class="text-white text-sm font-bold">Event Giveaways</h3>
			<button
				disabled
				class="px-3 py-1.5 bg-gray1 text-gray2 text-xs font-bold rounded-lg cursor-not-allowed flex items-center gap-1"
			>
				<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Create
			</button>
		</div>
		<p class="text-gray3 text-[10px]">Coming soon</p>
	</div>

	<div class="flex-1 overflow-y-auto px-3 pt-4 mb-4">
		<div class="flex flex-col items-center justify-center h-full text-center">
			<svg class="w-16 h-16 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
				<line x1="7" y1="7" x2="7.01" y2="7"></line>
			</svg>
			<p class="text-gray2 text-sm font-bold">Giveaways Coming Soon</p>
			<p class="text-gray3 text-xs mt-1">This feature will be available in a future update</p>
		</div>
	</div>
</div>