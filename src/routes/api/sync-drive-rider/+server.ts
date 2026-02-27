import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { google } from 'googleapis';
import { 
    GOOGLE_DRIVE_CLIENT_EMAIL, 
    GOOGLE_DRIVE_PRIVATE_KEY, 
    GOOGLE_DRIVE_ACTIVE_FOLDER_ID, 
    GOOGLE_DRIVE_ARCHIVE_FOLDER_ID 
} from '$env/static/private';
import stream from 'stream';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const formData = await request.formData();
        // Get all files appended to the 'files' key
        const files = formData.getAll('files') as File[];

        if (!files || files.length === 0) return json({ error: 'No files provided' }, { status: 400 });

        const privateKey = GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, '\n');
        const auth = new google.auth.GoogleAuth({
            credentials: { client_email: GOOGLE_DRIVE_CLIENT_EMAIL, private_key: privateKey },
            scopes: ['https://www.googleapis.com/auth/drive'],
        });

        const drive = google.drive({ version: 'v3', auth });

        // Search for existing PDF files ONLY
        const existingFiles = await drive.files.list({
            q: `'${GOOGLE_DRIVE_ACTIVE_FOLDER_ID}' in parents and trashed=false and mimeType != 'application/vnd.google-apps.folder'`,
            fields: 'files(id, name)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        });

        // Archive old files if they exist (This now only happens ONCE per update)
        if (existingFiles.data.files && existingFiles.data.files.length > 0) {
            for (const existingFile of existingFiles.data.files) {
                if (!existingFile.id) continue;
                await drive.files.update({
                    fileId: existingFile.id,
                    addParents: GOOGLE_DRIVE_ARCHIVE_FOLDER_ID,
                    removeParents: GOOGLE_DRIVE_ACTIVE_FOLDER_ID,
                    supportsAllDrives: true
                });
            }
        }

        const uploadedFileIds = [];

        // Loop through and upload both the Color and B&W files
        for (const file of files) {
            const buffer = Buffer.from(await file.arrayBuffer());
            const bufferStream = new stream.PassThrough();
            bufferStream.end(buffer);

            const uploadedFile = await drive.files.create({
                requestBody: { name: file.name, parents: [GOOGLE_DRIVE_ACTIVE_FOLDER_ID] },
                media: { mimeType: 'application/pdf', body: bufferStream },
                fields: 'id',
                supportsAllDrives: true
            });
            
            if (uploadedFile.data.id) uploadedFileIds.push(uploadedFile.data.id);
        }

        return json({ success: true, fileIds: uploadedFileIds });
    } catch (error) {
        console.error('Google Drive Sync Error:', error);
        return json({ error: 'Failed to sync with Google Drive' }, { status: 500 });
    }
};