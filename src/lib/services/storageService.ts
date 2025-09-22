import { supabase } from '$lib/supabase.js';

export async function cleanupEventFiles(
  eventId: number,
  artistName: string,
  bucket: string = 'documents'
): Promise<void> {
  try {
    const sanitizedArtistName = artistName.replace(/[^a-zA-Z0-9]/g, '_');
    const prefix = `contracts/${eventId}_${sanitizedArtistName}_`;

    // List all files with this prefix
    const { data: files, error } = await supabase.storage
      .from(bucket)
      .list('contracts', {
        limit: 100,
        search: `${eventId}_${sanitizedArtistName}_`
      });

    if (error) throw error;

    if (files && files.length > 0) {
      // Delete all matching files
      const filePaths = files.map(file => `contracts/${file.name}`);
      const { error: deleteError } = await supabase.storage
        .from(bucket)
        .remove(filePaths);

      if (deleteError) throw deleteError;

      console.log(`✅ Cleaned up ${files.length} files for event ${eventId}`);
    }

  } catch (error) {
    console.error('❌ Error cleaning up files:', error);
  }
}