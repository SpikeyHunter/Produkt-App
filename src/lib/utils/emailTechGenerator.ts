import type { EmailTechEvent, TechEmailForm, EmailFormat } from '$lib/types/emailtech';
import { buildTechModel, renderTemplateHtml, renderSimpleHtml, renderText } from './emailTechTemplate';

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
	const model = buildTechModel(events, form, senderName);
	return format === 'text' ? renderSimpleHtml(model) : renderTemplateHtml(model);
}

export function generateTechEmailText(events: EmailTechEvent[], form: TechEmailForm, senderName: string): string {
	if (!events.length) return '';
	return renderText(buildTechModel(events, form, senderName));
}
