<script lang="ts">
	import { onMount } from 'svelte';
	import DashboardTemplate from '$lib/components/dashboard/DashboardTemplate.svelte';

	interface CommitInfo {
		title: string;
		body: string;
		date?: string;
		author?: string;
	}

	let commits: CommitInfo[] = [];
	let isLoading = true;
	let currentIndex = 0;

	$: currentCommit = commits[currentIndex];

	// Updated to loop back to the beginning
	function showNext() {
		if (!commits.length) return;
		currentIndex = (currentIndex + 1) % commits.length;
	}

	// Updated to loop to the end
	function showPrevious() {
		if (!commits.length) return;
		currentIndex = (currentIndex - 1 + commits.length) % commits.length;
	}

	async function fetchLatestCommits() {
		const GITHUB_USERNAME = 'SpikeyHunter';
		const GITHUB_REPO = 'Produkt-App';
		const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/commits?per_page=10`;

		try {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				throw new Error(`GitHub API responded with ${response.status}`);
			}

			const data = await response.json();
			commits = data.map((commitData: any) => {
				const [title, ...bodyParts] = commitData.commit.message.split('\n\n');
				const body = bodyParts.join('\n\n').trim();
				const date = new Date(commitData.commit.author.date).toLocaleDateString('en-US', {
					month: 'short',
					day: 'numeric'
				});

				return { title, body, date };
			});
		} catch (error) {
			console.error('Error fetching commits from GitHub:', error);
			commits = [
				{
					title: 'v2.5.0',
					body: '• New dashboard layout\n• Added team management\n• Performance improvements',
					date: 'Oct 1'
				},
				{
					title: 'v2.4.2',
					body: '• Fixed advance card styling\n• Updated navigation\n• Bug fixes',
					date: 'Sep 30'
				},
				{
					title: 'v2.4.1',
					body: '• Added MOTD feature\n• Improved UI responsiveness',
					date: 'Sep 28'
				}
			];
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchLatestCommits();
	});
</script>

<DashboardTemplate title="Latest Updates" width={300} height={250}>
	<div slot="icon">
		<svg
			class="w-5 h-5 text-lime"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<polyline points="16 18 22 12 16 6" />
			<polyline points="8 6 2 12 8 18" />
		</svg>
	</div>

	{#if isLoading}
		<div class="animate-pulse space-y-2 w-full">
		<div class="h-4 bg-gray1 rounded w-3/4"></div>
		<div class="h-3 bg-gray1 rounded w-full"></div>
		<div class="h-3 bg-gray1 rounded w-5/6"></div>
		<div class="h-3 bg-gray1 rounded w-full mt-2"></div>
	</div>
	{:else if commits.length > 0}
		<div class="flex flex-col h-full justify-between">
			<div class="overflow-y-auto pr-2 custom-scrollbar flex-grow">
				{#if currentCommit}
					<div>
						<div class="flex items-center justify-between">
							<span class="text-lime font-bold text-sm truncate pr-2">{currentCommit.title}</span>
							{#if currentCommit.date}
								<span class="text-gray3 text-xs flex-shrink-0">{currentCommit.date}</span>
							{/if}
						</div>

						{#if currentCommit.body}
							<pre
								class="text-gray2 text-xs leading-relaxed whitespace-pre-wrap font-sans mt-1"
								>{currentCommit.body}</pre
							>
						{/if}
					</div>
				{/if}
			</div>

			<div class="flex items-center justify-center gap-4 mt-2 pt-2 border-t border-gray1 flex-shrink-0">
				<button
					on:click={showPrevious}
					class="text-gray3 hover:text-lime cursor-pointer transition-colors"
					aria-label="Previous update"
				>
					<svg
						class="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M15 19l-7-7 7-7"
						/></svg
					>
				</button>

				<span class="text-gray3 text-xs font-mono">
					{currentIndex + 1} / {commits.length}
				</span>

				<button
					on:click={showNext}
					class="text-gray3 hover:text-lime cursor-pointer transition-colors"
					aria-label="Next update"
				>
					<svg
						class="w-4 h-4"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/></svg
					>
				</button>
			</div>
		</div>
	{:else}
		<p class="text-gray2 text-sm">No version information available.</p>
	{/if}
</DashboardTemplate>

<style>
	.custom-scrollbar {
		scrollbar-width: thin;
		scrollbar-color: var(--color-gray3) transparent;
	}

	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}

	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}

	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: var(--color-gray3);
		border-radius: 2px;
	}
</style>