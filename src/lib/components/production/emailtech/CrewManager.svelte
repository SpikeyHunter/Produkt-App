<!-- src/lib/components/production/emailtech/CrewManager.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CrewMember, CrewAssignments, CrewRole } from '$lib/types/emailtech';

  export let crewMembers: CrewMember[] = [];
  export let assignments: CrewAssignments = {};
  
  const dispatch = createEventDispatcher();
  
  let showAddForm = false;
  let newCrewName = '';
  let newCrewEmail = '';
  let searchTerm = '';
  let draggedMember: CrewMember | null = null;
  let deleteConfirmId: string | null = null;
  let draggedOverRole: CrewRole | null = null;

  // Define role slots in 2 rows x 3 columns
  const roleSlots = [
    { role: 'LD' as CrewRole, label: 'LD' },
    { role: 'Video' as CrewRole, label: 'Video' },
    { role: 'VJ' as CrewRole, label: 'VJ' },
    { role: 'Sound' as CrewRole, label: 'Sound' },
    { role: 'Stage Manager' as CrewRole, label: 'Stage/Tech' },
    { role: 'DT' as CrewRole, label: 'DT' }
  ];

  $: filteredCrew = crewMembers.filter(member => {
    const search = searchTerm.toLowerCase();
    return member.name.toLowerCase().includes(search) || 
           (member.email && member.email.toLowerCase().includes(search));
  });

  function handleDragStart(member: CrewMember) {
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
    draggedOverRole = role;
  }

  function handleDragLeave() {
    draggedOverRole = null;
  }

  function handleDrop(e: DragEvent, role: CrewRole) {
    e.preventDefault();
    if (draggedMember) {
      assignments = { ...assignments, [role]: draggedMember.name };
      dispatch('assign', { role, crewMember: draggedMember });
      draggedMember = null;
      draggedOverRole = null;
    }
  }

  function clearAssignment(role: CrewRole) {
    const newAssignments = { ...assignments };
    delete newAssignments[role];
    assignments = newAssignments;
    dispatch('assign', { role, crewMember: null });
  }

  function showAddCrewForm() {
    showAddForm = true;
    newCrewName = '';
    newCrewEmail = '';
  }

  function cancelAddCrew() {
    showAddForm = false;
    newCrewName = '';
    newCrewEmail = '';
  }

  function addCrew() {
    if (!newCrewName.trim() || !newCrewEmail.trim()) return;
    dispatch('add', { name: newCrewName.trim(), email: newCrewEmail.trim() });
    cancelAddCrew();
  }

  function initiateDeleteCrew(member: CrewMember) {
    deleteConfirmId = member.id;
  }

  function confirmDeleteCrew(member: CrewMember) {
    dispatch('remove', member);
    deleteConfirmId = null;
  }

  function cancelDeleteCrew() {
    deleteConfirmId = null;
  }

  function getFirstName(fullName: string | undefined): string {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  }
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl overflow-hidden">
  <!-- Header -->
  <div class="p-4 border-b border-gray1 flex-shrink-0">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white text-sm font-bold">Crew Management</h3>
      <button
        type="button"
        on:click={showAddCrewForm}
        class="text-lime hover:text-white transition-colors cursor-pointer"
        title="Add Crew Member"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>

    <div class="relative">
      <input
        type="text"
        bind:value={searchTerm}
        placeholder="Search crew..."
        class="w-full bg-gray1 text-white rounded px-3 py-1.5 pl-8 text-xs
               placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
      />
      <svg 
        class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray2"
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        stroke-width="2"
      >
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    </div>
  </div>

  <!-- Crew List / Add Form -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if showAddForm}
      <!-- Add Form -->
      <div class="bg-gray1 rounded-lg p-3">
        <h4 class="text-white text-xs font-bold mb-2">Add New Crew Member</h4>
        <div class="space-y-2">
          <input
            type="text"
            bind:value={newCrewName}
            placeholder="Full Name *"
            class="w-full bg-navbar text-white rounded px-2 py-1.5 text-xs
                   placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
          />
          <input
            type="email"
            bind:value={newCrewEmail}
            placeholder="Email *"
            class="w-full bg-navbar text-white rounded px-2 py-1.5 text-xs
                   placeholder-gray2 focus:outline-none focus:ring-1 focus:ring-lime"
          />
          <div class="flex gap-2 pt-1">
            <button
              type="button"
              on:click={addCrew}
              disabled={!newCrewName.trim() || !newCrewEmail.trim()}
              class="flex-1 bg-lime text-black rounded px-3 py-1.5 text-xs font-bold
                     hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              on:click={cancelAddCrew}
              class="flex-1 bg-gray2 text-black rounded px-3 py-1.5 text-xs font-bold
                     hover:bg-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    {:else if filteredCrew.length > 0}
      <!-- Crew List -->
      <div class="space-y-2">
        {#each filteredCrew as member}
          <div
            role="button"
            tabindex="0"
            draggable="true"
            on:dragstart={() => handleDragStart(member)}
            on:dragend={handleDragEnd}
            class="group cursor-grab active:cursor-grabbing"
          >
            <div
              class="w-full bg-gray1 text-white rounded-lg p-2 transition-all duration-200
                     hover:bg-gray2 hover:text-black {draggedMember?.id === member.id ? 'opacity-50' : ''}"
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0 pr-2">
                  <div class="font-bold text-xs">{member.name}</div>
                  {#if member.email}
                    <div class="text-xs opacity-60 truncate">{member.email}</div>
                  {/if}
                </div>
                
                {#if deleteConfirmId === member.id}
                  <button
                    type="button"
                    on:click={() => confirmDeleteCrew(member)}
                    class="p-1.5 text-lime hover:text-white transition-colors cursor-pointer flex-shrink-0"
                    title="Confirm Delete"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                {:else}
                  <button
                    type="button"
                    on:click={() => initiateDeleteCrew(member)}
                    class="p-1.5 text-problem hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                    title="Delete Crew"
                  >
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {:else if crewMembers.length === 0}
      <div class="flex flex-col items-center justify-center h-32 text-center">
        <svg class="w-12 h-12 text-gray2 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        <p class="text-gray2 text-sm">No crew members</p>
        <button
          type="button"
          on:click={showAddCrewForm}
          class="mt-2 text-lime text-xs hover:underline cursor-pointer"
        >
          Add first crew member
        </button>
      </div>
    {:else}
      <div class="text-center text-gray2 text-sm">No matching crew</div>
    {/if}
  </div>

  <!-- Role Assignment Slots (2x3 Grid) -->
  <div class="p-4 border-t border-gray1 flex-shrink-0">
    <p class="text-xs text-gray2 mb-3">Drag crew to assign roles:</p>
    <div class="grid grid-cols-3 gap-2">
      {#each roleSlots as slot}
        <div
          role="button"
          tabindex="0"
          class="relative group"
          on:dragover={(e) => handleDragOver(e, slot.role)}
          on:dragleave={handleDragLeave}
          on:drop={(e) => handleDrop(e, slot.role)}
        >
          <div 
            class="bg-gray1 rounded-lg p-3 min-h-[80px] flex flex-col items-center justify-center
                   transition-all duration-200 relative border-2
                   {draggedOverRole === slot.role ? 'border-lime' : 'border-gray2'}
                   {assignments[slot.role] ? 'hover:border-red-400' : ''}"
          >
            <!-- Role Label (Top Left) -->
            <div class="absolute top-1.5 left-2 text-[9px] text-gray3 font-bold uppercase">
              {slot.label}
            </div>

            <!-- First Name (Center) -->
            {#if assignments[slot.role]}
              <div class="text-white font-bold text-sm text-center mt-1">
                {getFirstName(assignments[slot.role])}
              </div>
              
              <!-- Clear button - smaller circle positioned at the edge -->
              <button
                type="button"
                on:click={() => clearAssignment(slot.role)}
                class="absolute -top-1 -right-1 text-black bg-problem rounded-full w-4 h-4 flex items-center justify-center
                       hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                title="Clear assignment"
              >
                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            {:else}
              <div class="text-gray2 text-xs italic text-center">
                Drop here
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--color-navbar); }
  ::-webkit-scrollbar-thumb { background: var(--color-gray1); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--color-gray2); }
</style>