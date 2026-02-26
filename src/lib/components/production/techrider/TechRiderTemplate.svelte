<script lang="ts">
	export let documentData: any;
	export let theme: 'color' | 'bw' = 'color';

	// Theme classes mapping
	$: isBW = theme === 'bw';
	$: bgMain = isBW ? 'bg-white' : 'bg-[#2F2F2F]';
	$: bgSecondary = isBW ? 'bg-gray-100' : 'bg-[#212121]';
	$: textMain = isBW ? 'text-black' : 'text-white';
	$: textSecondary = isBW ? 'text-gray-600' : 'text-[#BDBDBB]';
	$: accent = isBW ? 'border-black' : 'border-[#E1FF00]';
	$: accentText = isBW ? 'text-black' : 'text-[#E1FF00]';
</script>

<div class="w-full font-sans {bgMain} {textMain} p-8">
	<div class="mb-10 text-center border-b-4 {accent} pb-6">
		<h1 class="text-4xl font-bold uppercase tracking-wider {accentText}">Technical Rider</h1>
		<p class="text-lg mt-2 {textSecondary}">
			{documentData.information?.location || 'New City Gas'}
		</p>
		<p class="text-sm mt-1 {textSecondary}">
			Last Updated: {documentData.last_updated_at || new Date().toLocaleDateString()}
		</p>
	</div>

	<div class="mb-12" style="page-break-after: always; break-inside: avoid;">
		<h2 class="text-2xl font-bold mb-6 {accentText} uppercase border-b {accent} inline-block pb-1">
			Table of Contents
		</h2>
		<ul class="space-y-3">
			{#if documentData.information}
				<li class="flex justify-between items-center border-b border-gray-500/30 pb-1">
					<span class="font-bold text-lg">General Information</span>
				</li>
			{/if}
			{#each documentData.sections || [] as section, index}
				<li class="flex justify-between items-center border-b border-gray-500/30 pb-1">
					<span class="font-bold text-lg">{index + 1}. {section.title}</span>
				</li>
			{/each}
		</ul>
	</div>

	{#if documentData.information}
		<div class="mb-8 p-6 rounded-2xl {bgSecondary}" style="break-inside: avoid;">
			<h2 class="text-xl font-bold mb-4 {accentText} uppercase">General Information</h2>
			<div class="grid grid-cols-2 gap-4">
				<div><strong class="{textSecondary}">Location:</strong> {documentData.information.location}</div>
				<div><strong class="{textSecondary}">Email:</strong> {documentData.information.email}</div>
				<div><strong class="{textSecondary}">Office:</strong> {documentData.information.office}</div>
				<div><strong class="{textSecondary}">Fax:</strong> {documentData.information.fax}</div>
				{#if documentData.information.website1}
					<div><strong class="{textSecondary}">Website:</strong> {documentData.information.website1}</div>
				{/if}
			</div>
		</div>
	{/if}

	{#each documentData.sections || [] as section, index}
		<div class="mb-8" style="break-inside: avoid;">
			<h2 class="text-2xl font-bold mb-4 {accentText} uppercase border-b {accent} pb-1">
				{index + 1}. {section.title}
			</h2>

			{#if section.type === 'text_content'}
				<div class="p-6 rounded-2xl whitespace-pre-line leading-relaxed {bgSecondary}">
					{section.text_content}
				</div>

			{:else if section.type === 'direction_map'}
				<div class="p-6 rounded-2xl {bgSecondary}">
					<div class="grid grid-cols-2 gap-4 mb-4">
						<div><strong class="{textSecondary} block mb-1">Main Entrance:</strong> {section.main_entrance}</div>
						<div><strong class="{textSecondary} block mb-1">Artist Entrance:</strong> {section.artist_entrance}</div>
					</div>
					{#if section.map_image_url}
						<div class="mt-4 border-2 border-gray-500/30 p-2 rounded-xl text-center">
							<img src={section.map_image_url} alt="Map" class="max-h-[400px] mx-auto rounded-lg" />
						</div>
					{/if}
				</div>

			{:else if section.type === 'capacity' || section.id === 'capacity'}
				<div class="grid grid-cols-1 gap-6">
					{#each section.rooms || [] as room}
						<div class="p-6 rounded-2xl {bgSecondary}" style="break-inside: avoid;">
							<h3 class="font-bold text-lg mb-4 uppercase tracking-wider">{room.name}</h3>
							<table class="w-full text-left">
								<thead>
									<tr class="border-b border-gray-500/50">
										<th class="pb-2 {textSecondary} uppercase text-xs">Type</th>
										<th class="pb-2 {textSecondary} uppercase text-xs text-right">Capacity</th>
									</tr>
								</thead>
								<tbody>
									{#each room.rows || [] as row}
										<tr class="border-b border-gray-500/20 last:border-0">
											<td class="py-2 font-medium">{row.type}</td>
											<td class="py-2 text-right font-bold">{row.quantity}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/each}
				</div>

			{:else if section.type === 'key_value'}
				<div class="p-6 rounded-2xl {bgSecondary} mb-6">
					<table class="w-full text-left">
						<thead>
							<tr class="border-b border-gray-500/50">
								{#each section.columns || ['Name', 'Details'] as colName}
									<th class="pb-2 {textSecondary} uppercase text-xs">{colName}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each section.rows || [] as row}
								<tr class="border-b border-gray-500/20 last:border-0">
									<td class="py-2 font-medium w-1/2">{row.col1}</td>
									<td class="py-2 font-bold w-1/2">{row.col2}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if section.categories}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each section.categories as cat}
							<div class="p-4 rounded-xl border border-gray-500/30" style="break-inside: avoid;">
								<h4 class="font-bold uppercase text-sm mb-3 {accentText}">{cat.name}</h4>
								<ul class="space-y-2">
									{#each cat.items || [] as item}
										<li class="flex justify-between items-start text-sm">
											<span>{item.name}</span>
											{#if item.isDimension || item.dimension}
												<span class="font-bold ml-2">{item.dimension}</span>
											{/if}
										</li>
									{/each}
								</ul>
								{#if cat.notes}
									<p class="mt-3 text-xs italic {textSecondary} border-t border-gray-500/20 pt-2">{cat.notes}</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

			{:else if section.type === 'equipment_tree'}
				<div class="grid grid-cols-1 gap-6">
					{#each section.categories || [] as category}
						<div class="p-6 rounded-2xl {bgSecondary}" style="break-inside: avoid;">
							<h3 class="font-bold text-lg mb-4 uppercase {accentText}">{category.name}</h3>
							<ul class="space-y-3">
								{#each category.items || [] as item}
									<li class="text-sm font-medium">
										<div class="flex items-start">
											<span class="mr-2 opacity-50">▪</span> {item.name}
										</div>
										{#if item.sub_items && item.sub_items.length > 0}
											<ul class="pl-5 mt-1 space-y-1">
												{#each item.sub_items as sub}
													<li class="text-xs {textSecondary} flex items-start">
														<span class="mr-2 opacity-50">↳</span> {sub}
													</li>
												{/each}
											</ul>
										{/if}
									</li>
								{/each}
							</ul>
							{#if category.notes}
								<div class="mt-4 pt-4 border-t border-gray-500/30 text-xs italic {textSecondary}">
									<strong>Notes:</strong> {category.notes}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/each}
</div>