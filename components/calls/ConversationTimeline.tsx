'use client'

import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, Hotel } from 'lucide-react'
import { ConversationTurn } from '@/types'
import { cn } from '@/lib/utils'

interface ConversationTimelineProps {
  turns: ConversationTurn[]
}

export function ConversationTimeline({ turns }: ConversationTimelineProps) {
  if (!turns.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum turno de conversa registrado
      </div>
    )
  }

  const sorted = [...turns].sort((a, b) => a.turn_number - b.turn_number)

  return (
    <div className="space-y-4">
      {sorted.map((turn) => {
        const isAgent = turn.role === 'agent'
        return (
          <div
            key={turn.id}
            className={cn('flex gap-3', isAgent ? 'flex-row' : 'flex-row-reverse')}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                isAgent ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600'
              )}
            >
              {isAgent ? <Bot className="h-4 w-4" /> : <Hotel className="h-4 w-4" />}
            </div>
            <div className={cn('flex-1 max-w-[75%]', !isAgent && 'text-right')}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">
                  {isAgent ? 'Agente TravelCom' : 'Hotel'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(turn.created_at), 'HH:mm:ss', { locale: ptBR })}
                </span>
              </div>
              <div
                className={cn(
                  'rounded-lg p-3 text-sm',
                  isAgent ? 'bg-primary/5 border border-primary/10' : 'bg-muted'
                )}
              >
                <p className="leading-relaxed">{turn.text_local}</p>
                {turn.text_pt && (
                  <p className="mt-2 text-xs text-muted-foreground italic border-t pt-2">
                    {turn.text_pt}
                  </p>
                )}
              </div>
              {turn.audio_url && (
                <div className="mt-1">
                  <audio controls src={turn.audio_url} className="h-7 w-full max-w-xs" />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
