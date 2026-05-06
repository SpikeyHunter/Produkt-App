<script lang="ts">
	import { portal } from '$lib/utils/portalUtils';
	import Modal from '$lib/components/modals/Modal.svelte';
	import { supabase } from '$lib/supabase';

	export let isOpen = false;

	let users: any[] = [];
	let selectedUserIds: string[] = [];
	let isLoading = false;
	let isSending = false;
	let searchQuery = '';

	// Message State
	let messageContent = '';
	let emailSubject = '';
	let sendViaSms = true;
	let sendViaEmail = false;

	$: filteredUsers = users.filter((u) => {
		if (!searchQuery) return true;
		const query = searchQuery.toLowerCase();
		const fullName = `${u.name || ''}`.toLowerCase();
		const email = (u.email || '').toLowerCase();
		const job = (u.job || '').toLowerCase();
		return fullName.includes(query) || email.includes(query) || job.includes(query);
	});

	$: if (isOpen && users.length === 0) {
		fetchUsers();
	}

	async function fetchUsers() {
		isLoading = true;
		const { data, error } = await supabase
			.from('calendar_users')
			.select('id, name, email, phone, job, role')
			.order('name');

		if (data && !error) {
			users = data;
		} else {
			console.error('Failed to load users:', error);
		}
		isLoading = false;
	}

	function toggleUserSelection(id: string) {
		if (selectedUserIds.includes(id)) {
			selectedUserIds = selectedUserIds.filter((userId) => userId !== id);
		} else {
			selectedUserIds = [...selectedUserIds, id];
		}
	}

	function selectAll() {
		selectedUserIds = filteredUsers.map((u) => u.id);
	}

	function clearSelection() {
		selectedUserIds = [];
	}

	function injectVariable(variable: string) {
		messageContent += variable;
	}

	async function sendMessage() {
		if (!messageContent.trim() || selectedUserIds.length === 0 || (!sendViaSms && !sendViaEmail) || (sendViaEmail && !emailSubject.trim())) {
			return;
		}

		isSending = true;
		const targetUsers = users.filter((u) => selectedUserIds.includes(u.id));

		try {
			const promises = [];

			if (sendViaSms) {
				promises.push(
					fetch('/api/send-message-sms', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ users: targetUsers, message: messageContent })
					}).then(res => {
						if (!res.ok) throw new Error('Failed to send SMS');
					})
				);
			}

			if (sendViaEmail) {
				promises.push(
					fetch('/api/send-message-email', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ users: targetUsers, message: messageContent, subject: emailSubject })
					}).then(res => {
						if (!res.ok) throw new Error('Failed to send Email');
					})
				);
			}

			await Promise.all(promises);
			
			alert('Message(s) successfully dispatched!');
			messageContent = '';
			emailSubject = '';
			selectedUserIds = [];
			isOpen = false;
		} catch (error: any) {
			console.error('Error sending messages:', error);
			alert('Failed to send messages. ' + error.message);
		} finally {
			isSending = false;
		}
	}
</script>

{#if isOpen}
	<div use:portal>
		<Modal
			bind:isOpen
			title="Produkt App - Send Messages"
			maxWidth="max-w-6xl"
			on:close={() => (isOpen = false)}
		>
			<div class="flex w-full h-[70vh] min-h-[600px] border border-gray1 rounded-xl overflow-hidden -mx-2 -mb-2 mt-2">
				
				<div class="w-1/3 min-w-[320px] border-r border-gray1 flex flex-col bg-[#1a1a1a] h-full shrink-0">
					<div class="p-4 border-b border-gray1 shrink-0 space-y-4">
						<div class="relative">
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search users..."
								class="w-full bg-navbar border border-gray1 text-white px-4 py-2 rounded-xl text-sm focus:outline-none focus:border-lime transition-colors placeholder:text-gray2"
							/>
							<svg
								class="w-4 h-4 text-gray2 absolute right-3 top-1/2 transform -translate-y-1/2"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<circle cx="11" cy="11" r="8"></circle>
								<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
							</svg>
						</div>
						
						<div class="flex justify-between items-center text-sm">
							<span class="text-gray2 font-bold">{selectedUserIds.length} Selected</span>
							<div class="space-x-3">
								<button on:click={selectAll} class="text-lime hover:underline font-medium cursor-pointer">Select All</button>
								<button on:click={clearSelection} class="text-gray2 hover:text-white hover:underline font-medium cursor-pointer">Clear</button>
							</div>
						</div>
					</div>

					<div class="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
						{#if isLoading}
							<div class="flex justify-center items-center h-full">
								<div class="w-8 h-8 border-2 border-lime border-t-transparent rounded-full animate-spin"></div>
							</div>
						{:else if filteredUsers.length === 0}
							<div class="p-6 text-center text-gray2 text-sm">No users found.</div>
						{:else}
							{#each filteredUsers as user}
								<label class="w-full text-left p-4 border-b border-gray1 transition-colors hover:bg-white/5 cursor-pointer flex items-start gap-4 {selectedUserIds.includes(user.id) ? 'bg-lime/5' : ''}">
									<input 
										type="checkbox" 
										class="mt-1 w-4 h-4 accent-lime cursor-pointer shrink-0" 
										checked={selectedUserIds.includes(user.id)}
										on:change={() => toggleUserSelection(user.id)}
									/>
									<div class="flex-1 overflow-hidden">
										<div class="font-bold text-white text-sm truncate">{user.name}</div>
										<div class="text-xs text-gray2 truncate mt-0.5">{user.job || 'No Job Title'}</div>
										<div class="flex gap-2 mt-1">
											{#if user.phone}
												<span class="text-[10px] bg-gray2/20 text-gray2 px-1.5 py-0.5 rounded uppercase">{user.phone}</span>
											{/if}
											{#if user.email}
												<span class="text-[10px] bg-gray2/20 text-gray2 px-1.5 py-0.5 rounded uppercase truncate max-w-[150px]">{user.email}</span>
											{/if}
										</div>
									</div>
								</label>
							{/each}
						{/if}
					</div>
				</div>

				<div class="flex-1 p-8 flex flex-col bg-navbar h-full overflow-hidden">
					
					<h3 class="text-xl font-bold text-white mb-6 uppercase tracking-wider shrink-0">Compose Message</h3>

					<div class="flex gap-4 mb-8 shrink-0">
						<button 
							on:click={() => sendViaSms = !sendViaSms}
							class="flex-1 py-4 px-6 rounded-3xl font-bold text-sm transition-all border-2 cursor-pointer flex items-center justify-center gap-2 {sendViaSms ? 'bg-lime text-black border-lime' : 'bg-transparent text-gray2 border-gray1 hover:border-gray2 hover:text-white'}"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
							SEND VIA SMS
						</button>
						<button 
							on:click={() => sendViaEmail = !sendViaEmail}
							class="flex-1 py-4 px-6 rounded-3xl font-bold text-sm transition-all border-2 cursor-pointer flex items-center justify-center gap-2 {sendViaEmail ? 'bg-lime text-black border-lime' : 'bg-transparent text-gray2 border-gray1 hover:border-gray2 hover:text-white'}"
						>
							<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
							SEND VIA EMAIL
						</button>
					</div>

					<div class="flex-1 flex flex-col min-h-0">
						
						{#if sendViaEmail}
						<div class="mb-5 shrink-0 transition-all">
							<label for="email-subject" class="text-sm font-semibold text-gray2 uppercase tracking-wider block mb-2">Email Subject</label>
							<input
								id="email-subject"
								type="text"
								bind:value={emailSubject}
								placeholder="Enter email subject..."
								class="w-full bg-black/30 border border-gray1 rounded-3xl px-6 py-4 text-white text-base focus:outline-none focus:border-lime transition-colors placeholder:text-gray2 font-medium"
							/>
						</div>
						{/if}

						<div class="flex justify-between items-end mb-2 shrink-0">
							<label for="message-content" class="text-sm font-semibold text-gray2 uppercase tracking-wider">Message Content</label>
							<div class="flex gap-2">
								<span class="text-xs text-gray2 self-center mr-1">Variables:</span>
								<button on:click={() => injectVariable('<name>')} class="text-xs font-bold bg-black/50 border border-gray1 hover:border-lime hover:text-lime text-gray2 px-2 py-1 rounded transition-colors cursor-pointer">{'<name>'}</button>
								<button on:click={() => injectVariable('<email>')} class="text-xs font-bold bg-black/50 border border-gray1 hover:border-lime hover:text-lime text-gray2 px-2 py-1 rounded transition-colors cursor-pointer">{'<email>'}</button>
								<button on:click={() => injectVariable('<phone>')} class="text-xs font-bold bg-black/50 border border-gray1 hover:border-lime hover:text-lime text-gray2 px-2 py-1 rounded transition-colors cursor-pointer">{'<phone>'}</button>
							</div>
						</div>
						
						<textarea
							id="message-content"
							bind:value={messageContent}
							placeholder="Type your message here... Use the buttons above to inject personal data."
							class="w-full flex-1 bg-black/30 border border-gray1 rounded-3xl p-6 text-white text-base focus:outline-none focus:border-lime transition-colors resize-none custom-scrollbar placeholder:text-gray2"
						></textarea>
						
						<div class="flex justify-between items-start mt-3 shrink-0">
							<p class="text-xs text-gray2">
								<span class="text-lime font-bold">PRO TIP:</span> Create an email button using <code class="bg-white/10 px-1 py-0.5 rounded text-[10px]">{'<https://link.com [alt=Click Here]>'}</code>
							</p>
							<p class="text-xs text-gray2 italic text-right">Preview data carefully before sending.</p>
						</div>
					</div>

					<div class="mt-8 pt-6 border-t border-gray1 flex justify-end gap-4 shrink-0">
						<button
							on:click={() => isOpen = false}
							class="px-8 py-3 rounded-3xl text-white font-bold hover:bg-white/5 transition-colors cursor-pointer"
						>
							Cancel
						</button>
						<button
							on:click={sendMessage}
							disabled={isSending || selectedUserIds.length === 0 || !messageContent.trim() || (!sendViaSms && !sendViaEmail) || (sendViaEmail && !emailSubject.trim())}
							class="bg-lime text-black font-bold py-3 px-10 rounded-3xl hover:opacity-90 disabled:opacity-50 flex items-center gap-2 cursor-pointer transition-transform active:scale-95"
						>
							{#if isSending}
								<div class="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
								Dispatching...
							{:else}
								Dispatch Message
							{/if}
						</button>
					</div>
				</div>
			</div>
		</Modal>
	</div>
{/if}

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.1);
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: rgba(204, 255, 0, 0.5); 
	}
</style>