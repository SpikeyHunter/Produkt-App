<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { CrewMember, CrewAssignments, CrewRole, EmailTechEvent } from '$lib/types/emailtech';
    
    export let crewMembers: CrewMember[] = [];
	export let assignments: CrewAssignments = {};
    export let selectedEvents: EmailTechEvent[] = [];

	const dispatch = createEventDispatcher();
    $: isEventSelected = selectedEvents && selectedEvents.length > 0;
    
    let showAddForm = false;
	let newCrewName = '';
	let newCrewEmail = '';
	let searchTerm = '';
	let draggedMember: CrewMember | null = null;
	let deleteConfirmId: string | null = null;
	let draggedOverRole: CrewRole | null = null;
    
    // Typed slots for iteration
    const roleSlots: { role: CrewRole; label: string }[] = [
		{ role: 'LD', label: 'LD' },
		{ role: 'Video', label: 'Video' },
		{ role: 'VJ', label: 'VJ' },
		{ role: 'Sound', label: 'Sound' },
		{ role: 'Stage/Tech', label: 'Stage/Tech' },
		{ role: 'DT', label: 'DT' }
	];
    
    $: filteredCrew = crewMembers
		.filter((member) => {
			const search = searchTerm.toLowerCase();
			return (
				member.name.toLowerCase().includes(search) ||
				(member.email && member.email.toLowerCase().includes(search))
			);
		})
		.sort((a, b) => a.name.localeCompare(b.name));

    function handleDragStart(member: CrewMember) {
        if (!isEventSelected) return;
		draggedMember = member;
		document.body.style.cursor = 'grabbing';
    }

    function handleDragEnd() {
		draggedMember = null;
		draggedOverRole = null;
		document.body.style.cursor = '';
	}

	function handleDragOver(e: DragEvent, role: CrewRole) {
		e.preventDefault();
        if (!isEventSelected) return;
        draggedOverRole = role;
	}

	function handleDragLeave() {
		draggedOverRole = null;
	}

	function handleDrop(e: DragEvent, role: CrewRole) {
		e.preventDefault();
        if (!isEventSelected) return;
        if (draggedMember) {
			const currentAssigned = assignments[role] || [];
			if (!currentAssigned.includes(draggedMember.name)) {
				const newAssigned = [...currentAssigned, draggedMember.name];
                const newAssignments: CrewAssignments = { ...assignments, [role]: newAssigned };
				assignments = newAssignments;
				dispatch('assign', { assignments: newAssignments });
			}
			draggedMember = null;
            draggedOverRole = null;
		}
	}
    
    function removeAssignment(role: CrewRole, nameToRemove: string) {
        if (!isEventSelected) return;
        const currentAssigned = assignments[role] || [];
		const newAssigned = currentAssigned.filter((name) => name !== nameToRemove);
		
        // Fix for Error 7015: Ensure strict object typing
		const newAssignments: CrewAssignments = { ...assignments };
        
        if (newAssigned.length > 0) {
            newAssignments[role] = newAssigned;
        } else {
            delete newAssignments[role];
        }
        
        assignments = newAssignments;
		dispatch('assign', { assignments: newAssignments });
    }

    function clearRole(role: CrewRole) {
        if (!isEventSelected) return;
		const newAssignments: CrewAssignments = { ...assignments };
        delete newAssignments[role];
		assignments = newAssignments;
		dispatch('assign', { assignments: newAssignments });
    }
    
    function clearAllAssignments() {
        if (!isEventSelected) return;
		assignments = {};
        dispatch('assign', { assignments: {} });
	}

	function getFirstName(fullName: string | undefined): string {
		if (!fullName) return '';
		return fullName.split(' ')[0];
    }
    
    function showAddCrewForm() { if (!isEventSelected) return; showAddForm = true; newCrewName = ''; newCrewEmail = ''; }
	function cancelAddCrew() { showAddForm = false; }
	function addCrew() {
		if (!newCrewName.trim() || !newCrewEmail.trim()) return;
        dispatch('add', { name: newCrewName.trim(), email: newCrewEmail.trim() });
		cancelAddCrew();
	}
	function initiateDeleteCrew(member: CrewMember) { if (!isEventSelected) return; deleteConfirmId = member.id; }
	function confirmDeleteCrew(member: CrewMember) { dispatch('remove', member); deleteConfirmId = null; }

</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl overflow-hidden transition-colors duration-300 {!isEventSelected ? 'cursor-not-allowed border-opacity-50' : ''}">
    
	<div class="p-4 border-b border-gray1 flex-shrink-0 transition-opacity duration-200 { !isEventSelected ? 'opacity-50' : '' }">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-white text-sm font-bold">Crew Management</h3>
            <button 
                type="button" 
                on:click={showAddCrewForm} 
                disabled={!isEventSelected} 
                class="text-lime hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:pointer-events-none" 
                title="Add Crew Member"
                aria-label="Add Crew Member"
            >
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
			</button>
        </div>
        
		<div class="relative">
			<input 
                type="text" 
                bind:value={searchTerm} 
                disabled={!isEventSelected} 
                placeholder="Search crew..." 
                class="w-full bg-gray1 text-white rounded px-3 py-1.5 pl-8 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime disabled:cursor-not-allowed disabled:pointer-events-none"
            />
            <svg class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
		</div>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 relative">
         {#if !isEventSelected}
            <div class="absolute inset-0 flex flex-col items-center justify-center text-gray2 text-sm opacity-60 z-10 pointer-events-none">
                <svg class="w-8 h-8 mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>Select an event to view crew</p>
            </div>
         {:else if showAddForm}
             <div class="bg-gray1 rounded-lg p-3">
				<h4 class="text-white text-xs font-bold mb-2">Add New Crew Member</h4>
				<div class="space-y-2">
					<input type="text" bind:value={newCrewName} placeholder="Full Name *" class="w-full bg-navbar text-white rounded px-2 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
					<input type="email" bind:value={newCrewEmail} placeholder="Email *" class="w-full bg-navbar text-white rounded px-2 py-1.5 text-xs placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime" />
					<div class="flex gap-2 pt-1">
						<button type="button" on:click={addCrew} disabled={!newCrewName.trim() || !newCrewEmail.trim()} class="flex-1 bg-lime text-black rounded px-3 py-1.5 text-xs font-bold hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Add</button>
						<button type="button" on:click={cancelAddCrew} class="flex-1 bg-gray2 text-black rounded px-3 py-1.5 text-xs font-bold hover:bg-white transition-colors cursor-pointer">Cancel</button>
					</div>
				</div>
			</div>
         {:else if filteredCrew.length > 0}
             <div class="space-y-2">
                 {#each filteredCrew as member (member.id)}
                    <div role="button" tabindex="0" draggable="true" on:dragstart={() => handleDragStart(member)} on:dragend={handleDragEnd} class="group cursor-grab active:cursor-grabbing">
                        <div class="w-full bg-gray1 text-white rounded-lg p-2 transition-all duration-200 hover:bg-gray2 hover:text-black {draggedMember?.id === member.id ? 'opacity-50' : ''}">
                            <div class="flex items-center justify-between">
                                <div class="flex-1 min-w-0 pr-2">
                                    <div class="font-bold text-xs">{member.name}</div>
                                    {#if member.email}<div class="text-xs opacity-60 truncate">{member.email}</div>{/if}
                                </div>
                                {#if deleteConfirmId === member.id}
									<button 
                                        type="button" 
                                        on:click|stopPropagation={() => confirmDeleteCrew(member)} 
                                        class="p-1.5 text-lime hover:text-white transition-colors cursor-pointer flex-shrink-0" 
                                        title="Confirm Delete"
                                        aria-label="Confirm Delete"
                                    >
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12" /></svg>
									</button>
								{:else}
									<button 
                                        type="button" 
                                        on:click|stopPropagation={() => initiateDeleteCrew(member)} 
                                        class="p-1.5 text-problem hover:text-red-400 transition-colors cursor-pointer flex-shrink-0" 
                                        title="Delete Crew"
                                        aria-label="Delete Crew"
                                    >
										<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
									</button>
								{/if}
                            </div>
                        </div>
                    </div>
                 {/each}
             </div>
         {:else}
             <div class="text-center text-gray2 text-sm pt-8">No crew found.</div>
         {/if}
    </div>
    
    <div class="p-4 border-t border-gray1 flex-shrink-0 transition-all duration-200 { !isEventSelected ? 'opacity-50 pointer-events-none' : '' }">
		<div class="flex justify-between items-center mb-3">
			<p class="text-xs text-gray2">Drag crew to assign roles:</p>
			<button type="button" on:click={clearAllAssignments} disabled={!isEventSelected} class="text-gray2 hover:text-white text-xs font-bold transition-colors px-2 py-1 rounded hover:bg-gray2">Clear All</button>
		</div>
         <div class="grid grid-cols-3 gap-2">
             {#each roleSlots as slot}
                {@const assignedNames = assignments[slot.role]}
                <div role="button" tabindex="0" class="relative group" on:dragover={(e) => handleDragOver(e, slot.role)} on:dragleave={handleDragLeave} on:drop={(e) => handleDrop(e, slot.role)}>
                    <div class="bg-gray1 rounded-lg p-3 min-h-[80px] h-full flex flex-col items-center justify-center transition-all duration-200 relative border-2 {draggedOverRole === slot.role ? 'border-lime' : 'border-gray2'}">
                        <div class="absolute top-1.5 left-2 text-[9px] text-gray3 font-bold uppercase">{slot.label}</div>
                        
                        {#if assignedNames && assignedNames.length > 0}
							<button 
                                type="button" 
                                on:click|stopPropagation={() => clearRole(slot.role)} 
                                class="absolute top-0 right-0 z-20 bg-gray1 rounded-full translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-hover:cursor-pointer transition-opacity" 
                                title="Clear all from {slot.label}"
                                aria-label="Clear all from {slot.label}"
                            >
								<svg class="w-5 h-5 text-gray-400 hover:text-problem" fill="currentColor" viewBox="0 0 20 20">
									<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
								</svg>
							</button>

                            <div class="flex flex-col items-center justify-center text-center pt-3">
                                {#each assignedNames as name (name)}
                                    <div 
                                        role="button" 
                                        tabindex="0" 
                                        on:click|stopPropagation={() => removeAssignment(slot.role, name)} 
                                        on:keydown 
                                        class="text-white text-xs cursor-pointer hover:text-problem transition-opacity" 
                                        title="Remove {name}"
                                        aria-label="Remove {name}"
                                    >
                                        {getFirstName(name)}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="text-gray2 text-xs italic text-center">Drop here</div>
                        {/if}
                    </div>
                </div>
             {/each}
         </div>
    </div>
</div>

<style>
	::-webkit-scrollbar { width: 6px; }
	::-webkit-scrollbar-track { background: #1a1a1a; }
	::-webkit-scrollbar-thumb { background: #e1ff00; border-radius: 3px; }
</style>