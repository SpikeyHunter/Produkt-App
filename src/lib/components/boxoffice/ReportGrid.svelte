<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { BOX_OFFICE_CATEGORIES } from '$lib/components/boxoffice/defaults';

    export let reportData: any;
    const dispatch = createEventDispatcher();

    function updateItem(category: string, index: number, field: string, value: any) {
        const newData = [...reportData[category]];
        newData[index][field] = value;
        dispatch('update', { [category]: newData });
    }

    function addItem(category: string) {
        const newData = [...reportData[category], {
            id: crypto.randomUUID(),
            ticket: '', category: 'GA', tier: 'Tier 1', price: 0, sold: 0, scanned: 0
        }];
        dispatch('update', { [category]: newData });
    }

    function removeItem(category: string, index: number) {
        const newData = reportData[category].filter((_: any, i: number) => i !== index);
        dispatch('update', { [category]: newData });
    }

    function formatCurrency(val: number) {
        return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(val || 0);
    }
</script>

<div class="p-6 text-white h-full overflow-y-auto pb-24">
    <h1 class="text-2xl font-black uppercase mb-6 text-lime">Scan Report</h1>

    {#each BOX_OFFICE_CATEGORIES as category}
        <div class="mb-8">
            <div class="flex justify-between items-center  pb-2">
                <h2 class="text-lg font-bold capitalize text-gray3">{category.replace('_', ' ')}</h2>
                <button class="text-xs text-lime border border-lime rounded-3xl px-2 py-1 hover:bg-lime hover:text-black cursor-pointer" on:click={() => addItem(category)}>+ Add Item</button>
            </div>

            <div class="w-full overflow-x-auto rounded-lg">
                <table class="w-full text-left text-sm border-collapse">
                    <thead>
                        <tr class="bg-[#333] text-gray2 text-[10px] uppercase tracking-wider">
                            <th class="p-2 border-r border-gray1/20 w-1/4">Ticket Name</th>
                            <th class="p-2 border-r border-gray1/20 w-32">Category</th>
                            <th class="p-2 border-r border-gray1/20 w-24">Tier</th>
                            <th class="p-2 border-r border-gray1/20 w-24 text-right">$ Price</th>
                            <th class="p-2 border-r border-gray1/20 w-20 text-center"># Sold</th>
                            <th class="p-2 border-r border-gray1/20 w-24 text-center"># Scanned</th>
                            <th class="p-2 border-r border-gray1/20 w-20 text-center">% Entry</th>
                            <th class="p-2 border-r border-gray1/20 w-32 text-right">Settle</th>
                            <th class="p-2 w-8"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each reportData[category] || [] as item, i}
                            {@const entryPct = item.sold > 0 ? (item.scanned / item.sold) * 100 : 0}
                            {@const settle = (item.price || 0) * (item.sold || 0)}
                            <tr class="border-b border-gray1 transition-colors group">
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="text" class="w-full bg-transparent px-2 py-2 focus:bg-white/10 outline-none" value={item.ticket} on:input={(e) => updateItem(category, i, 'ticket', (e.target as HTMLInputElement).value)} />
                                </td>
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="text" class="w-full bg-transparent px-2 py-2 focus:bg-white/10 outline-none" value={item.category} on:input={(e) => updateItem(category, i, 'category', (e.target as HTMLInputElement).value)} />
                                </td>
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="text" class="w-full bg-transparent px-2 py-2 focus:bg-white/10 outline-none" value={item.tier} on:input={(e) => updateItem(category, i, 'tier', (e.target as HTMLInputElement).value)} />
                                </td>
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="number" class="w-full bg-transparent px-2 py-2 text-right text-lime focus:bg-white/10 outline-none" value={item.price} on:input={(e) => updateItem(category, i, 'price', parseFloat((e.target as HTMLInputElement).value) || 0)} />
                                </td>
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="number" class="w-full bg-transparent px-2 py-2 text-center focus:bg-white/10 outline-none" value={item.sold} on:input={(e) => updateItem(category, i, 'sold', parseInt((e.target as HTMLInputElement).value) || 0)} />
                                </td>
                                <td class="p-0 border-r border-gray2/10">
                                    <input type="number" class="w-full bg-transparent px-2 py-2 text-center focus:bg-white/10 outline-none" value={item.scanned} on:input={(e) => updateItem(category, i, 'scanned', parseInt((e.target as HTMLInputElement).value) || 0)} />
                                </td>
                                <td class="p-2 border-r border-gray2/10 text-center text-gray3 font-bold bg-black/20">
                                    {entryPct.toFixed(1)}%
                                </td>
                                <td class="p-2 border-r border-gray2/10 text-right font-black text-white bg-black/20">
                                    {formatCurrency(settle)}
                                </td>
                                <td class="p-0 text-center align-middle">
                                    <button class="text-problem cursor-pointer hover:text-red-500 px-2 py-1" on:click={() => removeItem(category, i)}>✖</button>
                                </td>
                            </tr>
                        {/each}
                        {#if !reportData[category] || reportData[category].length === 0}
                            <tr>
                                <td colspan="9" class="p-4 text-center text-gray2 italic text-xs">No items in {category}. Click + Add Item.</td>
                            </tr>
                        {/if}
                    </tbody>

            
                </table>
            </div>
        </div>
    {/each}
</div>