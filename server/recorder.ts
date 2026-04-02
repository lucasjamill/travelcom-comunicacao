import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

/**
 * Buffers audio from all streams during a call and uploads on finalize.
 */
export class AudioRecorder {
  private sessionId: string
  private userOriginalChunks: Buffer[] = []
  private hotelOriginalChunks: Buffer[] = []

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  recordUserOriginal(chunk: Buffer): void {
    this.userOriginalChunks.push(chunk)
  }

  recordHotelOriginal(chunk: Buffer): void {
    this.hotelOriginalChunks.push(chunk)
  }

  async finalize(
    callId: string,
    transcriptPt: string[],
    transcriptLocal: string[]
  ): Promise<void> {
    try {
      const uploadPromises: Promise<string | null>[] = []

      if (this.userOriginalChunks.length > 0) {
        uploadPromises.push(
          this.uploadAudio(
            Buffer.concat(this.userOriginalChunks),
            `recordings/${this.sessionId}/operator-original.raw`
          )
        )
      } else {
        uploadPromises.push(Promise.resolve(null))
      }

      if (this.hotelOriginalChunks.length > 0) {
        uploadPromises.push(
          this.uploadAudio(
            Buffer.concat(this.hotelOriginalChunks),
            `recordings/${this.sessionId}/hotel-original.raw`
          )
        )
      } else {
        uploadPromises.push(Promise.resolve(null))
      }

      const [operatorUrl, hotelUrl] = await Promise.all(uploadPromises)

      const ptText = transcriptPt.length > 0 ? transcriptPt.join('\n') : null
      const localText = transcriptLocal.length > 0 ? transcriptLocal.join('\n') : null

      const updateData: Record<string, unknown> = {
        transcript_pt: ptText,
        transcript_local: localText,
      }
      if (operatorUrl) updateData.recording_url_original = operatorUrl
      if (hotelUrl) updateData.recording_url = hotelUrl

      const { error } = await supabase
        .from('calls')
        .update(updateData)
        .eq('id', callId)

      if (error) {
        console.error('[recorder] Failed to update call:', error.message)
      } else {
        console.log(`[recorder] Finalized recordings for call ${callId}`)
      }
    } catch (err) {
      console.error('[recorder] Finalize error:', err)
    }
  }

  private async uploadAudio(buffer: Buffer, path: string): Promise<string | null> {
    try {
      const filename = `${path}-${uuidv4()}.raw`
      const { error } = await supabase.storage
        .from('call-audio')
        .upload(filename, buffer, {
          contentType: 'application/octet-stream',
          upsert: false,
        })

      if (error) {
        console.error('[recorder] Upload error:', error.message)
        return null
      }

      const { data } = supabase.storage.from('call-audio').getPublicUrl(filename)
      return data.publicUrl
    } catch (err) {
      console.error('[recorder] Upload exception:', err)
      return null
    }
  }
}
