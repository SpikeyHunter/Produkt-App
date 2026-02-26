<script lang="ts">
	export let documentData: any;
	export let theme: 'color' | 'bw' = 'color';

	// Theme classes mapping
	$: isBW = theme === 'bw';
	$: bgMain = isBW ? 'bg-white' : 'bg-[#212121]';
	$: bgSecondary = isBW ? 'bg-gray-100' : 'bg-[#2F2F2F]';
	$: textMain = isBW ? 'text-black' : 'text-white';
	$: textSecondary = isBW ? 'text-gray-600' : 'text-[#BDBDBB]';
	$: accent = isBW ? 'border-black' : 'border-[#E1FF00]';
	$: accentText = isBW ? 'text-black' : 'text-[#E1FF00]';

	$: sections = documentData?.sections || [];

	// Manual page mapping for the Table of Content
	function getPageNumber(title: string) {
		const t = title.toUpperCase();
		if (t.includes('DIRECTION & MAP') || t.includes('LOADING DOCK') || t.includes('FREIGHT ELEVATOR')) return '3';
		if (t.includes('CAPACITY') || t.includes('STAGE')) return '4';
		if (t.includes('CONTROL BOOTH') || t.includes('POWER SOURCE') || t.includes('DRESSING ROOMS')) return '5';
		if (t.includes('TECHNICAL EQUIPMENT - MAIN ROOM')) return '6-8';
		if (t.includes('LOUNGE')) return '9';
		if (t.includes('NFT GALLERY')) return '9';
		if (t.includes('RISERS')) return '10';
		return '';
	}

	// Helper to determine if a section needs a page break
	function needsPageBreak(title: string) {
		const t = title.toUpperCase();
		return ['CAPACITY', 'CONTROL BOOTH', 'TECHNICAL EQUIPMENT - MAIN ROOM', 'TECHNICAL EQUIPMENT - LOUNGE', 'RISERS & DRAPE'].includes(t);
	}

	// Helper to determine if a category inside Main Room needs a page break
	function categoryNeedsPageBreak(name: string) {
		const n = name.toUpperCase();
		if (n === 'SOUND FOH') return true; 
		if (n === 'DJ EQUIPMENT') return true; 
		return false;
	}
</script>

<div class="w-full font-sans {bgMain} {textMain}">
	<div class="flex flex-col items-center justify-between min-h-[9in] px-12 py-16 text-center break-after-page">
		<div class="flex flex-col items-center justify-center w-full mt-6">
			{#if documentData.main_logo_url}
				<img 
					src={documentData.main_logo_url} 
					alt="Venue Logo" 
					class="max-w-[950px] max-h-[550px] object-contain ml-13 mb-6"
					style={isBW ? 'filter: invert(1) grayscale(100%);' : (documentData.main_logo_inverted ? 'filter: brightness(0) invert(1);' : '')}
				/>
			{/if}

			<h1 class="text-3xl font-bold uppercase tracking-widest {accentText} mb-2 whitespace-nowrap">
				Technical Rider & Directions
			</h1>

			<div class="text-[12px] font-bold {textSecondary} mb-8 tracking-wider">
				UPDATED ON {documentData.last_updated_at ? documentData.last_updated_at.split(' at ')[0].toUpperCase() : new Date().toLocaleDateString()}<br/>
				By {documentData.last_updated_by_name || 'UNKNOWN USER'}
			</div>

			{#if documentData.information}
				<div class="flex flex-col items-center text-[13px] {textMain} leading-[1.2] font-medium">
					{#if documentData.information.location}<div>{documentData.information.location}</div>{/if}
					{#if documentData.information.office}<div>Office: {documentData.information.office}</div>{/if}
					{#if documentData.information.fax}<div>Fax: {documentData.information.fax}</div>{/if}
					{#if documentData.information.email}<div>{documentData.information.email}</div>{/if}
					{#if documentData.information.website1}<div>{documentData.information.website1}</div>{/if}
					{#if documentData.information.website2}<div>{documentData.information.website2}</div>{/if}
				</div>
			{/if}
		</div>

	</div>

	<div class="px-10 py-10 break-after-page">
		<h2 class="text-3xl font-bold mb-8 {accentText} uppercase">
			TABLE OF CONTENT:
		</h2>
		<ul class="space-y-2.5">
			{#each sections as section, index}
				<li class="flex items-end w-full">
					<span class="font-bold text-sm uppercase tracking-wide">{index + 1}. {section.title}</span>
					<div class="flex-grow border-b-2 border-dotted border-gray-500/40 mx-4 mb-1"></div>
					<span class="font-bold text-sm text-right">{getPageNumber(section.title)}</span>
				</li>
			{/each}
		</ul>
	</div>

	<div class="px-10 pb-8 pt-4">
		{#each sections as section, index}
			<div class="mb-5 {needsPageBreak(section.title) ? 'break-before-page pt-6' : ''}" style={!needsPageBreak(section.title) ? 'break-inside: avoid;' : ''}>
				
				<h2 class="text-lg font-bold mb-3 {accentText} uppercase border-b-2 {accent} pb-1">
					{index + 1}. {section.title}
				</h2>

				{#if section.type === 'text_content'}
					<div class="p-4 rounded-xl whitespace-pre-line leading-tight font-medium text-xs {bgSecondary}">
						{section.text_content}
					</div>

				{:else if section.type === 'direction_map'}
					<div class="p-4 rounded-xl {bgSecondary}">
						<div class="grid grid-cols-2 gap-4 mb-3">
							<div><strong class="{textSecondary} block mb-1 uppercase text-[10px] tracking-wider">Main Entrance:</strong> <span class="font-bold text-xs">{section.main_entrance}</span></div>
							<div><strong class="{textSecondary} block mb-1 uppercase text-[10px] tracking-wider">Artist Entrance:</strong> <span class="font-bold text-xs">{section.artist_entrance}</span></div>
						</div>
						{#if section.map_image_url}
							<div class="mt-2 p-1.5 rounded-xl border border-black/20 text-center">
								<img 
									src={section.map_image_url} 
									alt="Map" 
									class="max-h-[300px] w-full object-cover rounded-lg" 
									style={isBW ? 'filter: grayscale(100%);' : ''}
								/>
							</div>
						{/if}
					</div>

				{:else if section.type === 'capacity' || section.id === 'capacity'}
					<div class="grid grid-cols-2 gap-4">
						{#each section.rooms || [] as room}
							<div class="p-4 rounded-xl {bgSecondary}" style="break-inside: avoid;">
								<h3 class="font-bold text-sm mb-2 uppercase tracking-wider">{room.name}</h3>
								<table class="w-full text-left border-collapse text-xs">
									<thead>
										<tr class="border-b-2 border-gray-500/30">
											<th class="pb-1.5 {textSecondary} uppercase text-[9px] tracking-wider">Type</th>
											<th class="pb-1.5 {textSecondary} uppercase text-[9px] tracking-wider text-right">Capacity</th>
										</tr>
									</thead>
									<tbody>
										{#each room.rows || [] as row}
											<tr class="border-b border-gray-500/10 last:border-0">
												<td class="py-1.5 font-bold">{row.type}</td>
												<td class="py-1.5 text-right font-bold">{row.quantity}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/each}
					</div>

				{:else if section.type === 'key_value'}
					<div class="p-4 rounded-xl {bgSecondary} mb-4">
						<table class="w-full text-left border-collapse text-xs">
							<thead>
								<tr class="border-b-2 border-gray-500/30">
									{#each section.columns || ['Name', 'Details'] as colName}
										<th class="pb-1.5 {textSecondary} uppercase text-[9px] tracking-wider">{colName}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each section.rows || [] as row}
									<tr class="border-b border-gray-500/10 last:border-0">
										<td class="py-1.5 font-bold w-1/2">{row.col1}</td>
										<td class="py-1.5 font-bold w-1/2">{row.col2}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					{#if section.categories}
						<div class="grid grid-cols-1 gap-3 mt-3">
							{#each section.categories as cat}
								<div class="p-3 rounded-xl bg-black/10" style="break-inside: avoid;">
									<h4 class="font-bold uppercase text-[11px] mb-2 {accentText} tracking-wider">{cat.name}</h4>
									<ul class="space-y-1">
										{#each cat.items || [] as item}
											<li class="flex justify-between items-start text-[11px] font-bold pl-1">
												<span>{item.name}</span>
												{#if item.isDimension || item.dimension}
													<span class="ml-2 whitespace-nowrap text-right">{item.dimension}</span>
												{/if}
											</li>
										{/each}
									</ul>
									{#if cat.notes}
										<p class="mt-2 text-[9px] font-bold {textSecondary} border-t border-gray-500/20 pt-1.5 uppercase">{cat.notes}</p>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

				{:else if section.type === 'equipment_tree'}
					<div class="flex flex-col gap-3 w-full">
						{#each section.categories || [] as category}
							<div class="p-4 rounded-xl {bgSecondary} {categoryNeedsPageBreak(category.name) ? 'break-before-page mt-6' : ''} w-full" style={section.title.toUpperCase().includes('RISERS') ? '' : 'break-inside: avoid;'}>
								<h3 class="font-bold text-[12px] mb-3 uppercase tracking-wider {accentText}">{category.name}</h3>
								
								{#if section.title.toUpperCase().includes('RISERS')}
									<div class="grid grid-cols-2 gap-x-6 gap-y-4 w-full">
										{#each category.items || [] as item}
											<div class="flex flex-col break-inside-avoid">
												<div class="font-bold text-[11px] mb-1 {isBW ? 'text-black' : 'text-white'} border-b border-gray-500/30 pb-1">{item.name}</div>
												{#if item.sub_items && item.sub_items.length > 0}
													<ul class="space-y-0.5">
														{#each item.sub_items as sub}
															<li class="text-[10px] font-bold {textSecondary} flex items-start">
																{sub}
															</li>
														{/each}
													</ul>
												{/if}
											</div>
										{/each}
									</div>
								{:else}
									<ul class="space-y-1.5 w-full">
										{#each category.items || [] as item}
											<li class="text-[11px] font-bold pl-1.5">
												<div class="flex items-start">
													{item.name}
												</div>
												{#if item.sub_items && item.sub_items.length > 0}
													<ul class="pl-3 mt-0.5 space-y-0.5">
														{#each item.sub_items as sub}
															<li class="text-[10px] font-bold {textSecondary} flex items-start">
																{sub}
															</li>
														{/each}
													</ul>
												{/if}
											</li>
										{/each}
									</ul>
								{/if}

								{#if category.notes}
									<div class="mt-3 pt-2 border-t border-gray-500/20 text-[9px] font-bold {textSecondary} uppercase tracking-wider">
										NOTES: {category.notes}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>