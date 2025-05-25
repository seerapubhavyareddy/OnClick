// lib/types/transcript.ts
export interface TranscriptWord {
  text: string
  start_time?: number
  end_time?: number
  confidence?: number
}

export interface TranscriptSegment {
  speaker?: string
  text?: string
  words?: TranscriptWord[]
  start_time?: number
  end_time?: number
}

export type RecallTranscript = TranscriptSegment[]