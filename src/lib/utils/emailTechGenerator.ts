import type { EmailTechEvent, TechEmailForm, EmailFormat } from '$lib/types/emailtech';
import { get } from 'svelte/store';
import { emailSettings } from '$lib/services/emailSettingsService';
import { buildTechModel, renderTemplateHtml, renderSimpleHtml, renderText, type ModelOptions } from './emailTechTemplate';

/** colour swatches for the Lights block, from Settings */
function modelOptions(): ModelOptions {
	const colors: Record<string, string> = {};
	get(emailSettings).lights.colors.forEach((c) => (colors[c.label] = c.hex));
	return { lightColors: colors };
}

/**
 * Generates the Tech Email Filename
 * Format: Email-Tech_[Event_Name]
 */
export function generateTechFileName(events: EmailTechEvent[]): string {
	const mainEvent = events[0];
	if (!mainEvent) return 'Email-Tech_Export';

	let name = mainEvent.event_name || mainEvent.artist_name || 'Event';
	name = name.replace(/[^a-zA-Z0-9-_]/g, '_').replace(/_+/g, '_');

	return `Email-Tech_${name}`;
}

/**
 * Tech email body. `format` picks the boxed template ('html') or plain
 * paragraphs ('text'); both are HTML for the mail client — the text/plain
 * part comes from generateTechEmailText().
 */
export function generateTechEmailString(
	events: EmailTechEvent[],
	form: TechEmailForm,
	senderName: string,
	format: EmailFormat = form.email_format || 'html'
): string {
	if (!events.length) return '';
	const model = buildTechModel(events, form, senderName, modelOptions());
	return format === 'text' ? renderSimpleHtml(model) : renderTemplateHtml(model);
}

export function generateTechEmailText(events: EmailTechEvent[], form: TechEmailForm, senderName: string): string {
	if (!events.length) return '';
	return renderText(buildTechModel(events, form, senderName, modelOptions()));
}
