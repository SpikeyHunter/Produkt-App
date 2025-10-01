<script lang="ts">
	export let title: string = 'Card Title';
	export let width: number = 300;
	export let height: number = 250;

	// Reactive style for custom dimensions
	$: cardStyle = `width: ${width}px; height: ${height}px;`;
</script>

<div class="dashboard-card" style={cardStyle}>
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center gap-2">
			<slot name="icon" />
			<h2 class="text-lg font-bold text-white">
				<slot name="title">{title}</slot>
			</h2>
		</div>
		<slot name="header-actions" />
	</div>

	<div class="flex-1 overflow-hidden">
		<slot />
	</div>
</div>

<style>
	.dashboard-card {
		background: var(--color-navbar);
		border-radius: 16px;
		padding: 20px;
		transition: transform 0.2s ease, box-shadow 0.2s ease;
		display: flex;
		flex-direction: column;
	}

	.dashboard-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
</style>