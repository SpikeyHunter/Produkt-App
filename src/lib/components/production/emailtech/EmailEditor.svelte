<!-- src/lib/components/production/emailtech/EmailEditor.svelte -->
<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Highlight from '@tiptap/extension-highlight';
	import { TextStyle } from '@tiptap/extension-text-style';
	import { Color } from '@tiptap/extension-color';
	import type { CurrentUser, PresenceInfo } from '$lib/types/emailtech';

	export let content = '';
	export let editable = true;
	export let currentUser: CurrentUser;
	export let presenceState: Record<string, PresenceInfo[]> = {};
	export let remoteBroadcast: { event: string; payload: any } | null = null;
	export let eventName: string = '';
	export let eventDate: string = '';
	export let templateType: 'tech' | 'vj' = 'tech';

	const dispatch = createEventDispatcher();
	let editorElement: HTMLDivElement;
	let editor: Editor;
	
	// Expose editor instance for parent component
	export function getEditor() {
		return editor;
	}
	
	let remoteCursors: Array<{ user: CurrentUser; top: number; left: number }> = [];
	const highlightColors = {
		confirmed: '#86EFAC',
		tentatif: '#FCD34D',
		proposed: '#FDBA74',
		problem: '#FCA5A5',
		info: '#c4b5fd',
		question: '#93c5fd'
	};

	let isBold = false;
	let isItalic = false;
	let isUnderlined = false;
	let activeHighlight: string | null = null;

	function formatDate(dateString: string): string {
		if (!dateString) return '';
		const date = new Date(dateString);
		const day = date.getDate();
		const suffix = ['th', 'st', 'nd', 'rd'][
			day % 10 > 3 || [11, 12, 13].includes(day % 100) ? 0 : day % 10
		];
		const month = date.toLocaleString('en-US', { month: 'long' });
		const year = date.getFullYear();
		return `${month} ${day}${suffix} ${year}`;
	}

	$: formattedDate = formatDate(eventDate);
	$: headerTitle =
		templateType === 'tech'
			? `${eventName || 'Event'} | Set times + tech riders > ${formattedDate}`
			: `Undefined VJ > | ${eventName || 'Event'} > ${formattedDate}`;
	
	onMount(() => {
		editor = new Editor({
			element: editorElement,
			extensions: [
				StarterKit.configure({
					bulletList: {
						keepMarks: true,
						keepAttributes: false
					},
					listItem: {
						HTMLAttributes: {
							style: 'font-weight: 400;'
						}
					},
					orderedList: false,
					bold: {
						HTMLAttributes: {
							style: 'font-weight: 700;'
						}
					},
					paragraph: {
						HTMLAttributes: {
							style: 'font-weight: 400;'
						}
					}
				}),
				Underline.configure({
					HTMLAttributes: {
						style: 'text-decoration: underline;'
					}
				}),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: {
						class: 'text-lime underline',
						style: 'color: #E1FF00; text-decoration: underline;'
					},
					autolink: true,
					linkOnPaste: true
				}),
				Highlight.configure({
					multicolor: true,
					HTMLAttributes: {
						class: 'highlight-text'
					}
				}),
				TextStyle,
				Color
			],
			content: content || '<p></p>',
			editable: editable,
			onUpdate: ({ editor }) => {
				const html = editor.getHTML();
				content = html;
				dispatch('change', { content: html });
				updateToolbarState();
			},
			onSelectionUpdate: ({ editor }) => {
				updateToolbarState();
				const { from, to } = editor.state.selection;
				dispatch('cursorChange', { start: from, end: to });
			},
			editorProps: {
				attributes: {
					class: 'min-h-full text-gray3 text-sm focus:outline-none tiptap-editor',
					style: 'white-space: pre-wrap; word-wrap: break-word; font-weight: 400; line-height: 1.4;'
				},
				handlePaste: (view, event, slice) => {
					return false;
				}
			}
		});
		document.addEventListener('keydown', handleKeyboardShortcuts);
	});

	onDestroy(() => {
		editor?.destroy();
		document.removeEventListener('keydown', handleKeyboardShortcuts);
	});
	
	$: if (editor && editor.isEditable !== editable) {
		editor.setEditable(editable);
	}

	$: if (editor && content !== editor.getHTML() && !editor.isFocused) {
		editor.commands.setContent(content);
	}

	$: if (remoteBroadcast && editor) {
		handleRemoteBroadcast(remoteBroadcast);
	}

	function handleRemoteBroadcast(broadcast: { event: string; payload: any }) {
		if (broadcast.event === 'content' && !editor.isFocused) {
			if (broadcast.payload.content !== editor.getHTML()) {
				editor.commands.setContent(broadcast.payload.content);
			}
		}
		if (broadcast.event === 'cursor' && broadcast.payload.user.id !== currentUser.id) {
			updateRemoteCursor(broadcast.payload);
		}
	}

	function handleKeyboardShortcuts(e: KeyboardEvent) {
		if (!editor || !editor.isFocused) return;
		if (e.key === 'Tab') {
			e.preventDefault();
			if (editor.isActive('bulletList')) {
				if (e.shiftKey) {
					editor.chain().focus().liftListItem('listItem').run();
				} else {
					editor.chain().focus().sinkListItem('listItem').run();
				}
			} else {
				if (e.shiftKey) {
					outdent();
				} else {
					indent();
				}
			}
		}
	}

	function toggleBold() {
		editor?.chain().focus().toggleBold().run();
	}

	function toggleItalic() {
		editor?.chain().focus().toggleItalic().run();
	}

	function toggleUnderline() {
		editor?.chain().focus().toggleUnderline().run();
	}

	function toggleBulletList() {
		editor?.chain().focus().toggleBulletList().run();
	}

	function indent() {
		if (!editor) return;
		editor.chain().focus().insertContent('\t').run();
	}

	function outdent() {
		if (!editor) return;
		const { from } = editor.state.selection;
		const textBefore = editor.state.doc.textBetween(Math.max(0, from - 1), from, '');
		if (textBefore === '\t') {
			editor
				.chain()
				.focus()
				.deleteRange({ from: from - 1, to: from })
				.run();
		}
	}

	function applyHighlight(color: string) {
		if (!editor) return;
		const currentHighlight = editor.getAttributes('highlight').color;

		if (currentHighlight === color) {
			editor.chain().focus().unsetHighlight().setColor('#ffffff').run();
		} else {
			editor.chain().focus().setHighlight({ color }).setColor('#212121').run();
		}

		updateToolbarState();
	}

	function updateToolbarState() {
		if (!editor) return;
		isBold = editor.isActive('bold');
		isItalic = editor.isActive('italic');
		isUnderlined = editor.isActive('underline');
		if (editor.isActive('highlight')) {
			activeHighlight = editor.getAttributes('highlight').color || null;
		} else {
			activeHighlight = null;
		}
	}

	function updateRemoteCursor(payload: { user: CurrentUser; cursor: { start: number } }) {
		if (!editor || !editor.view || !editorElement || payload.user.id === currentUser.id) return;

		const { start } = payload.cursor;
		const coords = editor.view.coordsAtPos(start);
		const parentRect = editorElement.parentElement!.getBoundingClientRect();

		const top = coords.top - parentRect.top;
		const left = coords.left - parentRect.left;

		const existingCursorIndex = remoteCursors.findIndex((c) => c.user.id === payload.user.id);

		if (existingCursorIndex !== -1) {
			remoteCursors[existingCursorIndex] = { ...remoteCursors[existingCursorIndex], top, left };
			remoteCursors = remoteCursors;
		} else {
			remoteCursors = [...remoteCursors, { user: payload.user, top, left }];
		}
	}

	$: {
		const activeUserIds = Object.values(presenceState)
			.flat()
			.map((p) => p.user.id);
		remoteCursors = remoteCursors.filter((c) => activeUserIds.includes(c.user.id));
	}
</script>

<div class="h-full flex flex-col bg-navbar border border-gray1 rounded-xl relative min-w-0">
	<div class="p-3 border-b border-gray1 flex items-center justify-between flex-shrink-0">
		<h3 class="text-white text-sm font-bold truncate flex-1 min-w-0 pr-4">{headerTitle}</h3>
		<div class="flex items-center gap-2 flex-shrink-0">
			{#each Object.values(presenceState).flat() as presence (presence.user.id)}
				<div class="relative">
					<div
						role="button"
						tabindex="0"
						class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black border-4 cursor-pointer transition-all hover:border-white hover:shadow-lg"
						style="background-color: {presence.user.color}; border-color: {presence.user.color};"
						onmouseenter={(e) => {
							const rect = e.currentTarget.getBoundingClientRect();
							const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
							if (tooltip) {
								tooltip.style.top = `${rect.top - 35}px`;
								tooltip.style.left = `${rect.left + rect.width / 2}px`;
								tooltip.style.opacity = '1';
							}
						}}
						onmouseleave={(e) => {
							const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
							if (tooltip) tooltip.style.opacity = '0';
						}}
					>
						{presence.user.name.charAt(0).toUpperCase()}
					</div>
					<div
						class="fixed text-xs px-2 py-1 rounded-2xl shadow-2xl font-medium whitespace-nowrap z-[9999] opacity-0 transition-opacity pointer-events-none -translate-x-1/2"
						style="background-color: {presence.user.color}; color: #000000;"
					>
						{presence.user.name.charAt(0).toUpperCase() + presence.user.name.slice(1)}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<div class="px-3 py-2 border-b border-gray1 flex items-center gap-2 flex-wrap flex-shrink-0">
		<div class="flex items-center gap-1 border-r border-gray1 pr-2">
			<button
				type="button"
				onclick={toggleBold}
				class="p-1.5 hover:bg-gray1 rounded transition-colors cursor-pointer {isBold
					? 'bg-lime text-black'
					: 'text-white'}"
				title="Bold (Cmd/Ctrl+B)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
					<path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
				</svg>
			</button>
			<button
				type="button"
				onclick={toggleItalic}
				class="p-1.5 hover:bg-gray1 rounded transition-colors cursor-pointer {isItalic
					? 'bg-lime text-black'
					: 'text-white'}"
				title="Italic (Cmd/Ctrl+I)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<line x1="19" y1="4" x2="10" y2="4"></line>
					<line x1="14" y1="20" x2="5" y2="20"></line>
					<line x1="15" y1="4" x2="9" y2="20"></line>
				</svg>
			</button>
			<button
				type="button"
				onclick={toggleUnderline}
				class="p-1.5 hover:bg-gray1 rounded transition-colors cursor-pointer {isUnderlined
					? 'bg-lime text-black'
					: 'text-white'}"
				title="Underline (Cmd/Ctrl+U)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
					<line x1="4" y1="21" x2="20" y2="21"></line>
				</svg>
			</button>
		</div>

		<div class="flex items-center gap-1 border-r border-gray1 pr-2">
			<button
				type="button"
				onclick={toggleBulletList}
				class="p-1.5 hover:bg-gray1 rounded transition-colors text-white cursor-pointer"
				title="Bullet List"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
					<circle cx="4" cy="7" r="1.5"></circle>
					<circle cx="4" cy="12" r="1.5"></circle>
					<circle cx="4" cy="17" r="1.5"></circle>
					<line x1="8" y1="7" x2="21" y2="7" stroke="currentColor" stroke-width="2"></line>
					<line x1="8" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="2"></line>
					<line x1="8" y1="17" x2="21" y2="17" stroke="currentColor" stroke-width="2"></line>
				</svg>
			</button>
			<button
				type="button"
				onclick={outdent}
				class="p-1.5 hover:bg-gray1 rounded transition-colors text-white cursor-pointer"
				title="Outdent (Shift+Tab)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="7 8 3 12 7 16"></polyline>
					<line x1="21" y1="12" x2="11" y2="12"></line>
					<line x1="21" y1="6" x2="11" y2="6"></line>
					<line x1="21" y1="18" x2="11" y2="18"></line>
				</svg>
			</button>
			<button
				type="button"
				onclick={indent}
				class="p-1.5 hover:bg-gray1 rounded transition-colors text-white cursor-pointer"
				title="Indent (Tab)"
			>
				<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<polyline points="3 8 7 12 3 16"></polyline>
					<line x1="21" y1="12" x2="11" y2="12"></line>
					<line x1="21" y1="6" x2="11" y2="6"></line>
					<line x1="21" y1="18" x2="11" y2="18"></line>
				</svg>
			</button>
		</div>

		<div class="flex items-center gap-1.5">
			{#each Object.entries(highlightColors) as [name, color]}
				<button
					type="button"
					onclick={() => applyHighlight(color)}
					class="w-5 h-5 rounded-full transition-all cursor-pointer {activeHighlight === color
						? 'ring-2 ring-offset-2 ring-offset-navbar ring-white scale-110'
						: 'border-2 border-gray-700 hover:border-white'}"
					style="background-color: {color};"
					title={name.charAt(0).toUpperCase() + name.slice(1)}
				></button>
			{/each}
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-4 relative min-h-0 editor-scroll">
		{#each remoteCursors as cursor (cursor.user.id)}
			<div
				class="absolute pointer-events-none"
				style="top: {cursor.top}px; left: {cursor.left}px; z-index: 10;"
			>
				<div
					class="absolute w-0.5 h-4"
					style="background-color: {cursor.user.color};"
				></div>
				<div
					class="absolute top-0 left-0 -mt-6 px-2 py-0.5 rounded text-xs text-black whitespace-nowrap"
					style="background-color: {cursor.user.color};"
				>
					{cursor.user.name}
				</div>
			</div>
		{/each}
		<div bind:this={editorElement} class="min-h-full p-6 bg-[#2a2a2a] rounded-lg"></div>
	</div>
</div>

<style>
	:global(.tiptap) {
		min-height: 100%;
		color: #f1f1f1;
		font-weight: 400 !important;
		line-height: 1.4 !important;
	}

	:global(.tiptap *) {
		font-weight: inherit;
	}

	:global(.tiptap p) {
		margin: 0 0 0.5em 0;
		font-weight: 400 !important;
		line-height: 1.4 !important;
	}

	:global(.tiptap strong),
	:global(.tiptap b) {
		font-weight: 700 !important;
	}

	:global(.tiptap strong u),
	:global(.tiptap u strong),
	:global(.tiptap b u),
	:global(.tiptap u b) {
		font-weight: 700 !important;
		text-decoration: underline !important;
	}

	:global(.tiptap em) {
		font-style: italic;
		font-weight: 400 !important;
	}

	:global(.tiptap strong em),
	:global(.tiptap em strong),
	:global(.tiptap b em),
	:global(.tiptap em b) {
		font-weight: 700 !important;
		font-style: italic !important;
	}

	:global(.tiptap u) {
		text-decoration: underline !important;
		font-weight: 400 !important;
	}

	:global(.tiptap a) {
		color: #e1ff00 !important;
		text-decoration: underline !important;
		cursor: pointer;
		font-weight: 400 !important;
	}

	:global(.tiptap ul) {
		list-style-type: disc;
		margin: 0.25em 0;
		padding-left: 1.5rem;
	}

	:global(.tiptap li) {
		margin: 0;
		padding: 0;
		line-height: 1.4 !important;
		font-weight: 400 !important;
	}

	:global(.tiptap li p) {
		margin: 0;
		line-height: 1.4 !important;
	}

	:global(.tiptap mark) {
		padding: 2px 4px;
		border-radius: 3px;
		font-weight: inherit !important;
	}

	:global(.editor-scroll::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.editor-scroll::-webkit-scrollbar-track) {
		background: #1a1a1a;
		border-radius: 4px;
	}

	:global(.editor-scroll::-webkit-scrollbar-thumb) {
		background: #e1ff00;
		border-radius: 4px;
	}

	:global(.editor-scroll::-webkit-scrollbar-thumb:hover) {
		background: #f0ff4d;
	}

	:global(.editor-scroll) {
		scrollbar-width: thin;
		scrollbar-color: #e1ff00 #1a1a1a;
	}

	:global(.tiptap) {
		white-space: pre-wrap;
		tab-size: 4;
	}
</style>