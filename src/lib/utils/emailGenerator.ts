import type { EmailTechEvent, TechEmailForm, EmailFormat } from '$lib/types/emailtech';
import { buildVJModel, renderTemplateHtml, renderSimpleHtml, renderText, formatLongDate, type RenderOptions } from './emailTechTemplate';

/**
 * Generates a file name for the VJ email: VJ_Name_Month_Day_Year
 */
export function generateVJFileName(events: EmailTechEvent[]): string {
    const mainEvent = events[0];
    if (!mainEvent) return 'VJ_Email_Export';

    const vjCrew = mainEvent.crew?.['VJ'] || [];
    const vjName = vjCrew.length > 0 ? vjCrew[0].split(' ')[0] : 'VJ';
    
    if (!mainEvent.event_date) return `VJ_${vjName}_Date_TBD`;

    const date = new Date(mainEvent.event_date);
    const localDate = new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
    
    const month = localDate.toLocaleString('en-US', { month: 'long' });
    const day = localDate.getDate();
    const year = localDate.getFullYear();

    return `VJ_${vjName}_${month}_${day}_${year}`;
}

/** VJ email body — same model/renderers as the tech email. */
export function generateVJEmailString(
    events: EmailTechEvent[],
    form: TechEmailForm,
    senderName: string,
    format: EmailFormat = form.email_format || 'html',
    render: RenderOptions = {}
): string {
    if (!events.length) return '';
    const model = buildVJModel(events, form, senderName);
    return format === 'text' ? renderSimpleHtml(model) : renderTemplateHtml(model, render);
}

export function generateVJEmailText(events: EmailTechEvent[], form: TechEmailForm, senderName: string): string {
    if (!events.length) return '';
    return renderText(buildVJModel(events, form, senderName));
}

export function formatDate(dateStr: string | null): string {
    return formatLongDate(dateStr);
}

export function stripHtml(html: string): string {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(/<li>/gi, '• ').replace(/<\/li>/gi, '\n').replace(/<[^>]+>/g, '');
}
