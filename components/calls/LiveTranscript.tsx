'use client'

import { useEffect, useRef } from 'react'

export interface TranscriptEntry {
  role: 'operator' | 'operator_translated' | 'hotel' | 'hotel_translated'
  text: string
  language: string
  timestamp: number
}

interface LiveTranscriptProps {
  entries: TranscriptEntry[]
  operatorLanguage: string
  hotelLanguage: string
}

function roleLabel(role: TranscriptEntry['role']): string {
  switch (role) {
    case 'operator': return 'Operador'
    case 'operator_translated': return 'Operador (traduzido)'
    case 'hotel': return 'Hotel'
    case 'hotel_translated': return 'Hotel (traduzido)'
  }
}

function roleColor(role: TranscriptEntry['role']): string {
  switch (role) {
    case 'operator': return 'text-blue-700 dark:text-blue-400'
    case 'operator_translated': return 'text-blue-500/70 dark:text-blue-400/70'
    case 'hotel': return 'text-emerald-700 dark:text-emerald-400'
    case 'hotel_translated': return 'text-emerald-500/70 dark:text-emerald-400/70'
  }
}

function roleBg(role: TranscriptEntry['role']): string {
  switch (role) {
    case 'operator':
    case 'operator_translated':
      return 'bg-blue-50 dark:bg-blue-950/30'
    case 'hotel':
    case 'hotel_translated':
      return 'bg-emerald-50 dark:bg-emerald-950/30'
  }
}

export function LiveTranscript({ entries, operatorLanguage, hotelLanguage }: LiveTranscriptProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries.length])

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        A transcrição aparecerá aqui quando a tradução começar...
      </div>
    )
  }

  return (
    <div className="space-y-2 overflow-y-auto max-h-[400px] p-3">
      {entries.map((entry, i) => (
        <div key={i} className={`rounded-md px-3 py-2 text-sm ${roleBg(entry.role)}`}>
          <span className={`font-medium ${roleColor(entry.role)}`}>
            {roleLabel(entry.role)}
            <span className="text-xs ml-1 opacity-60">
              ({entry.language === operatorLanguage ? operatorLanguage.toUpperCase() : hotelLanguage.toUpperCase()})
            </span>
          </span>
          <p className="mt-0.5">{entry.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
