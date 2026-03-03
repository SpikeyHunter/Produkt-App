<script lang="ts">
	export let userRole = 'Email Only';

	// Grants access if they are an Editor, Calendar Admin, or Global App Admin
	$: hasAccess = ['Editor', 'Admin'].includes(userRole);
</script>

{#if !hasAccess}
	<div class="flex-1 flex items-center justify-center p-6 bg-navbar">
		<p class="text-gray2 font-bold text-lg">You do not have permission to view this.</p>
	</div>
{:else}
	<div class="px-6 py-6 border-b border-gray2/10 flex flex-col gap-4 shrink-0">
		<h2 class="text-xl font-black uppercase tracking-wide text-white">Revenue</h2>
	</div>
	<div class="p-6 flex-1 overflow-y-auto custom-scrollbar flex flex-col">
		<div class="w-full text-gray2 font-medium flex items-start justify-start border-2 border-dashed border-gray2/10 rounded-xl p-6">
			<p>Revenue content will load here.</p>
		</div>
	</div>
{/if}