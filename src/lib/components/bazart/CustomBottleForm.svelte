<script lang="ts">
    import { createEventDispatcher, onMount } from 'svelte';
    import { supabase } from '$lib/supabase.js';

    const dispatch = createEventDispatcher();
    
    let currentLang: 'fr' | 'en' = 'en';
    let isSaving = false;
    let isGeneratingAI = false;

    let isTypeOpen = false;
    let typeDropdownRef: HTMLDivElement;

    let fileInput: HTMLInputElement;
    let selectedFile: File | null = null;
    let previewUrl: string | null = null;
    let uploadError = '';
    let isDragging = false; 

    const customTypes = [
        { en: 'White wine', fr: 'Vin blanc', color: '#f8ebc0' },
        { en: 'Red wine', fr: 'Vin rouge', color: '#e05959' },
        { en: 'Rosé', fr: 'Rosé', color: '#f7a3b1' },
        { en: 'Natural wines', fr: 'Vins natures', color: '#bcce7c' },
        { en: 'Orange wines', fr: 'Vins oranges', color: '#fd9c5c' },
        { en: 'Dessert wines', fr: 'Vins de dessert', color: '#e097c4' },
        { en: 'Scotch', fr: 'Scotch', color: '#f17127' },
        { en: 'Whiskey', fr: 'Whiskey', color: '#f17127' },
        { en: 'Liqueur', fr: 'Liqueur', color: '#e6b294' },
        { en: 'Cream', fr: 'Crème', color: '#e6b294' },
        { en: 'Gin', fr: 'Gin', color: '#8ab5ee' },
        { en: 'Rum', fr: 'Rhum', color: '#c79357' },
        { en: 'Vodka', fr: 'Vodka', color: '#dfe4e7' },
        { en: 'Tequila', fr: 'Tequila', color: '#eec84d' },
        { en: 'Cognac', fr: 'Cognac', color: '#e49217' },
        { en: 'Brandy', fr: 'Brandy', color: '#e49217' },
        { en: 'Champagne', fr: 'Champagne', color: '#f5d3a0' },
        { en: 'Sparkling wine', fr: 'Vin mousseux', color: '#f5d3a0' },
        { en: 'Prosecco', fr: 'Prosecco', color: '#f5d3a0' }
    ];

    type BottleData = {
        name: { en: string; fr: string; [key: string]: string };
        type: { en: string; fr: string; [key: string]: string };
        price: string;
        glass_price: string;
        description: { en: string; fr: string; [key: string]: string };
        details: { en: Record<string, any>; fr: Record<string, any>; [key: string]: Record<string, any> };
        tasting: { en: Record<string, any>; fr: Record<string, any>; [key: string]: Record<string, any> };
    };

    let formData: BottleData = {
        name: { en: '', fr: '' },
        type: { en: '', fr: '' },
        price: '',
        glass_price: '',
        description: { en: '', fr: '' },
        details: { en: {}, fr: {} },
        tasting: { en: {}, fr: {} }
    };

    const col1Keys: Record<string, string[]> = {
        en: ['Country', 'Region', 'Regulated Designation', 'Degree of alcohol', 'Sugar content'],
        fr: ['Pays', 'Région', 'Désignation réglementée', "Degré d'alcool", 'Taux de sucre']
    };

    const col2Keys: Record<string, string[]> = {
        en: ['Special feature', 'Size', 'Producer'],
        fr: ['Particularité', 'Format', 'Producteur']
    };

    const tastingKeys: Record<string, string[]> = {
        en: ['Vintage tasted', 'aromas', 'acidity', 'sweetness', 'body', 'mouthfeel', 'wood', 'serving_temperature'],
        fr: ['Millésime dégusté', 'aromas', 'acidité', 'sucrosité', 'corps', 'bouche', 'bois', 'serving_temperature']
    };

    onMount(() => {
        function handleClickOutside(event: any) {
            if (typeDropdownRef && !typeDropdownRef.contains(event.target)) {
                isTypeOpen = false;
            }
        }
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    });

    function toggleTypeDropdown(e: Event) {
        e.stopPropagation();
        isTypeOpen = !isTypeOpen;
    }

    function selectType(t: any) {
        formData.type = { en: t.en, fr: t.fr };
        isTypeOpen = false;
    }

    async function checkTransparency(file: File): Promise<boolean> {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return resolve(false);
                ctx.drawImage(img, 0, 0);
                const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
                for (let i = 3; i < data.length; i += 4) {
                    if (data[i] < 255) {
                        resolve(true);
                        return;
                    }
                 }
                resolve(false);
            };
            img.src = URL.createObjectURL(file);
        });
    }

    async function processFile(file: File) {
        uploadError = '';

        if (file.type !== 'image/png') {
            uploadError = 'Must be a PNG image.';
            return;
        }

        const isTransparent = await checkTransparency(file);

        if (!isTransparent) {
            uploadError = 'PNG must have a transparent background.';
            return;
        }

        selectedFile = file;
        previewUrl = URL.createObjectURL(file);
    }

function handleFileSelect(event: any) {
    if (event.target && event.target.files && event.target.files.length > 0) {
        const file = event.target.files;
        // FIX: Pass file[0] instead of file
        processFile(file[0]); 
    }
}

function handleDrop(event: any) {
    isDragging = false;
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files;
        // FIX: Pass file[0] instead of file
        processFile(file[0]); 
    }
}

    async function generateAI() {
        if (!formData.name.en || !formData.type.en) {
            alert('Please enter a Name and select a Type first.');
            return;
        }

        isGeneratingAI = true;

        try {
            const res = await fetch('/api/generate-bottle-details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formData.name.en, type: formData.type.en })
            });

            if (!res.ok) throw new Error('Failed to generate AI data');

            const aiData = await res.json();
            formData.description = aiData.description || {en:'', fr:''};
            formData.details = aiData.details || {en:{}, fr:{}};
            formData.tasting = aiData.tasting || {en:{}, fr:{}};
        } catch (e) {
            console.error(e);
            alert('Error generating details with AI.');
        }
        isGeneratingAI = false;
    }

    async function saveChanges() {
        if (!selectedFile || !formData.name.en || !formData.type.en || !formData.price) {
            alert('Image, Name, Type, and Price are mandatory.');
            return;
        }

        isSaving = true;

        try {
            const fileName = `custom_${Date.now()}.png`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('bazart')
                .upload(`bottles/${fileName}`, selectedFile, { contentType: 'image/png', upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('bazart').getPublicUrl(`bottles/${fileName}`);

            const { error: dbError } = await supabase.from('bazart_menu_drink').insert({
                name: formData.name,
                type: formData.type,
                price: parseFloat(formData.price),
                glass_price: formData.glass_price ? parseFloat(formData.glass_price) : null,
                bottle_image: publicUrlData.publicUrl,
                description: formData.description,
                details: formData.details,
                tasting: formData.tasting,
                status: 'Available'
            });

            if (dbError) throw dbError;

            dispatch('saved');

        } catch (e) {
            console.error(e);
            alert('Error saving custom bottle.');
        }
        
        isSaving = false;
    }
</script>

<div
	class="bg-navbar border border-gray2/10 rounded-2xl h-full flex flex-col text-white shadow-sm w-full overflow-hidden"
>
	<div class="px-5 pt-5 pb-3 flex justify-between items-start shrink-0 gap-2">
		<div>
			<h2 class="text-lg font-black uppercase tracking-wide text-lime">Add Custom</h2>
			<p class="text-xs text-gray2 font-bold mt-0.5">Fill details manually or use AI.</p>
		</div>

		<div class="flex bg-black/40 p-1 rounded-full border border-gray1 shrink-0">
			<button
				type="button"
				class="px-3 py-1 rounded-3xl text-[11px] font-bold transition-all cursor-pointer {currentLang ===
				'fr'
					? 'bg-lime text-black'
					: 'text-gray2 hover:text-white'}"
				on:click={() => (currentLang = 'fr')}
			>
				FR
			</button>
			<button
				type="button"
				class="px-3 py-1 rounded-3xl text-[11px] font-bold transition-all cursor-pointer {currentLang ===
				'en'
					? 'bg-lime text-black'
					: 'text-gray2 hover:text-white'}"
				on:click={() => (currentLang = 'en')}
			>
				EN
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto pl-5 pr-1 custom-scrollbar flex flex-col min-h-0">
		<div class="pr-3 space-y-4 pb-4">
			<div class="flex flex-col gap-1">
				<span class="text-xs text-gray2 uppercase tracking-widest font-bold pb-2"
					>Bottle Image (Transparent PNG) <span class="text-problem">*</span></span
				>
				<label
					class="w-full h-32 border-2 border-dashed {uploadError
						? 'border-problem/50 bg-problem/5'
						: isDragging
							? 'border-lime bg-lime/10'
							: 'border-gray1 hover:border-lime hover:bg-white/5'} rounded-2xl flex items-center justify-center cursor-pointer transition-all relative overflow-hidden group"
					on:dragover|preventDefault={() => (isDragging = true)}
					on:dragleave|preventDefault={() => (isDragging = false)}
					on:drop|preventDefault={handleDrop}
				>
					<input
						type="file"
						accept=".png"
						class="hidden"
						bind:this={fileInput}
						on:change={handleFileSelect}
					/>
					{#if previewUrl}
						<img src={previewUrl} alt="Preview" class="h-full object-contain p-2 drop-shadow-xl" />
						<div
							class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
						>
							<span class="text-xs font-bold">Replace Image</span>
						</div>
					{:else}
						<div class="text-center pointer-events-none">
							<svg
								class="mx-auto h-6 w-6 {isDragging
									? 'text-lime'
									: 'text-gray2'} mb-1 transition-colors"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
								/>
							</svg>
							<span
								class="text-xs {isDragging
									? 'text-lime font-bold'
									: 'text-gray3 font-medium'} transition-colors">Drop PNG here or click</span
							>
						</div>
					{/if}
				</label>
				{#if uploadError}
					<span class="text-[10px] text-problem font-bold pl-1 pb-2">{uploadError}</span>
				{/if}
			</div>

			<div class="flex flex-col gap-2">
				<div class="flex flex-col gap-0.5">
					<span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-1 pb-2"
						>Name <span class="text-problem">*</span></span
					>
					<input
						type="text"
						bind:value={formData.name[currentLang]}
						placeholder="Name"
						class="w-full text-sm font-bold text-white bg-black/20 border border-transparent rounded-3xl px-4 py-2 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left placeholder-gray2/30"
					/>
				</div>

				<div class="flex flex-row gap-3">
					<div class="flex flex-col gap-0.5 flex-1 relative" bind:this={typeDropdownRef}>
						<span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-1 pb-2"
							>Type <span class="text-problem">*</span></span
						>
						<button
							type="button"
							on:click={toggleTypeDropdown}
							class="w-full flex items-center justify-between bg-black/20 border border-transparent text-white font-bold text-sm rounded-3xl py-2 px-4 focus:outline-none transition-colors cursor-pointer hover:bg-white/5"
						>
							<span class="truncate">{formData.type[currentLang] || 'Select...'}</span>
							<svg
								class="w-3.5 h-3.5 text-gray2 shrink-0 transition-transform {isTypeOpen
									? 'rotate-180'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/></svg
							>
						</button>

						{#if isTypeOpen}
							<div
								class="absolute top-[60px] z-50 w-full bg-navbar border border-gray2/20 rounded-2xl shadow-2xl overflow-hidden py-1 max-h-48 overflow-y-auto custom-scrollbar"
							>
								{#each customTypes as t}
									<button
										type="button"
										class="w-full text-left px-4 py-2 text-xs font-bold transition-colors cursor-pointer hover:bg-white/5 flex items-center gap-2"
										on:click={() => selectType(t)}
									>
										<span class="w-2 h-2 rounded-full shrink-0" style="background-color: {t.color};"
										></span>
										<span class="truncate">{t[currentLang]}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<div class="flex flex-col gap-0.5 w-1/4 relative">
						<span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-1 pb-2"
							>Glass $</span
						>
						<span class="absolute left-3 top-8.5 text-gray2 font-bold text-sm">$</span>
						<input
							type="number"
							bind:value={formData.glass_price}
							placeholder="0.00"
							class="w-full text-sm font-bold text-white bg-black/20 border border-transparent rounded-3xl py-2 pl-7 pr-3 hover:bg-white/5 focus:bg-black/40 focus:outline-none transition-all text-left placeholder-gray2/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
					</div>

					<div class="flex flex-col gap-0.5 w-1/4 relative">
						<span class="text-xs text-gray2 uppercase tracking-widest font-bold pl-1 pb-2"
							>Price <span class="text-problem">*</span></span
						>
						<span class="absolute left-3 top-8.5 text-gray2 font-bold text-sm">$</span>
						<input
							type="number"
							bind:value={formData.price}
							placeholder="0.00"
							class="w-full text-sm font-bold text-white bg-black/20 border border-transparent rounded-3xl py-2 pl-7 pr-3 hover:bg-white/5 focus:bg-black/40 focus:outline-none transition-all text-left placeholder-gray2/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
						/>
					</div>
				</div>
			</div>

			<button
				type="button"
				on:click={generateAI}
				disabled={isGeneratingAI || !formData.name.en || !formData.type.en}
				class="w-full bg-lime text-black font-black uppercase tracking-widest text-[10px] py-2.5 rounded-3xl transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				{#if isGeneratingAI}
					<svg
						class="animate-spin h-4 w-4 text-black"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Generating Details...
				{:else}
					<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2.5"
							d="M13 10V3L4 14h7v7l9-11h-7z"
						/></svg
					>
					Fill Out with AI
				{/if}
			</button>

			<div class="grid grid-cols-2 gap-x-2 gap-y-2 pt-6">
				<div class="flex flex-col gap-2">
					{#each col1Keys[currentLang] as key}
						<div class="flex flex-col gap-0.5">
							<span
								class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-1 pb-2 leading-tight break-words"
								>{key}</span
							>
							<textarea
								rows="2"
								bind:value={formData.details[currentLang][key]}
								class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar placeholder-gray1/40"
								placeholder="..."
							></textarea>
						</div>
					{/each}
				</div>

				<div class="flex flex-col gap-2">
					{#each col2Keys[currentLang] as key}
						<div class="flex flex-col gap-0.5">
							<span
								class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-1 pb-2 leading-tight break-words"
								>{key}</span
							>
							<textarea
								rows="2"
								bind:value={formData.details[currentLang][key]}
								class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar placeholder-gray1/40"
								placeholder="..."
							></textarea>
						</div>
					{/each}
				</div>
			</div>

			<hr class="border-gray1/40" />

			<div class="flex flex-col gap-0.5">
				<span class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-1 pb-2"
					>Detailed Info</span
				>
				<textarea
					bind:value={formData.description[currentLang]}
					class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-justify min-h-[90px] resize-y leading-relaxed custom-scrollbar placeholder-gray1/40"
					placeholder="..."
				></textarea>
			</div>

			<hr class="border-gray1/40" />

			<div class="grid grid-cols-2 gap-x-2 gap-y-2">
				{#each tastingKeys[currentLang] as key}
					<div class="flex flex-col gap-0.5">
						<span
							class="text-[10px] text-gray2 uppercase tracking-widest font-bold pl-1 pb-2 leading-tight break-words"
							>{key}</span
						>
						<textarea
							rows="2"
							bind:value={formData.tasting[currentLang][key]}
							class="w-full text-sm font-medium text-white bg-transparent border border-transparent rounded-2xl px-3 py-1.5 hover:bg-white/5 hover:border-white/10 focus:bg-black/40 focus:border-transparent focus:outline-none transition-all text-left resize-none leading-snug custom-scrollbar placeholder-gray1/40"
							placeholder="..."
						></textarea>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div
		class="px-5 py-3 border-t flex flex-row items-center justify-end border-black/40 shrink-0 gap-2"
	>
		<button
			type="button"
			on:click={() => dispatch('close')}
			disabled={isSaving}
			class="px-4 py-1.5 rounded-3xl text-white hover:bg-white/10 transition-colors font-bold text-sm cursor-pointer disabled:opacity-50"
		>
			Cancel
		</button>
		<button
			type="button"
			on:click={saveChanges}
			disabled={isSaving}
			class="bg-lime hover:opacity-90 disabled:opacity-50 disabled:bg-gray2 text-black font-black uppercase tracking-wide px-5 py-1.5 rounded-3xl transition-all duration-200 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
		>
			{isSaving ? 'Saving...' : 'Save Custom'}
		</button>
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 3px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.15);
		border-radius: 10px;
	}
	.custom-scrollbar:hover::-webkit-scrollbar-thumb {
		background-color: rgba(255, 255, 255, 0.3);
	}
</style>
