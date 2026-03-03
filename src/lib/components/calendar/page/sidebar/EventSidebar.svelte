<script lang="ts">
	export let activeTab: string;
	export let isSidebarOpen: boolean;
	export let userRole: string;

	// Permission check consistent with Header and Tabs
	$: isEditor = ['Editor', 'Admin'].includes(userRole);
</script>

<div class="transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden shrink-0 {isSidebarOpen ? 'w-[320px] opacity-100' : 'w-0 opacity-0'}">
	<div class="w-[320px] h-full bg-navbar border border-gray2/10 rounded-2xl shadow-sm flex flex-col overflow-hidden">
		<div class="px-6 py-6 border-b border-gray2/10 shrink-0">
			<h3 class="text-xs font-black text-gray2 uppercase tracking-widest mb-4">Sidebar</h3>
			<div class="bg-gray1 rounded-xl border border-gray2/10 p-4">
				<p class="text-xs font-bold text-gray2 uppercase tracking-wider mb-1">Active Module</p>
				<p class="text-sm font-bold text-white truncate">{activeTab} Details</p>
			</div>
		</div>

		<div class="p-6 flex-1 overflow-y-auto custom-scrollbar">
			{#if isEditor || userRole === 'Manager'}
				<div class="space-y-6">
					<div>
						<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Tasks</h4>
						{#if isEditor}
							<button class="w-full py-2 border border-gray2/20 rounded-lg text-sm font-bold text-gray2 hover:text-white hover:bg-white/5 cursor-pointer transition-colors">
								+ Add a task
							</button>
						{/if}
					</div>
					<div>
						<h4 class="text-xs font-bold text-white uppercase tracking-wider mb-2">Activity Log</h4>
						<div class="h-24 bg-gray1 rounded-lg border border-gray2/10 flex items-center justify-center text-xs text-gray2 font-medium">
							No recent activity
						</div>
					</div>
				</div>
			{:else}
				<div class="h-full flex items-center justify-center text-center">
					<p class="text-gray2 text-sm font-bold">You do not have permission to view sidebar details.</p>
				</div>
			{/if}
		</div>
	</div>
</div>