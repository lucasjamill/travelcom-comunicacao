'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { CallStatusBadge } from '@/components/reservations/StatusBadge'
import { ConversationTimeline } from '@/components/calls/ConversationTimeline'
import { TranscriptViewer } from '@/components/calls/TranscriptViewer'
import { AudioPlayer } from '@/components/calls/AudioPlayer'
import { Call, ConversationTurn } from '@/types'

interface CallWithTurns extends Call {
  conversation_turns: ConversationTurn[]
}

export default function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [call, setCall] = useState<CallWithTurns | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchCall() {
    try {
      const res = await fetch(`/api/calls/${id}`)
      if (!res.ok) throw new Error('Chamada não encontrada')
      const data = await res.json()
      setCall(data)
    } catch {
      toast.error('Erro ao carregar chamada')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCall()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!call) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Chamada não encontrada
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/reservations/${call.reservation_id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Detalhes da Chamada</h1>
            <CallStatusBadge status={call.status} />
          </div>
          <p className="text-muted-foreground">
            {format(new Date(call.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            {call.duration_seconds && (
              <> &middot; {Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</>
            )}
            {call.confirmation_number && (
              <> &middot; Confirmação: <span className="font-mono font-medium">{call.confirmation_number}</span></>
            )}
          </p>
        </div>
        <Button variant="outline" onClick={fetchCall}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {call.recording_url && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gravação da Chamada</CardTitle>
          </CardHeader>
          <CardContent>
            <AudioPlayer src={call.recording_url} label="Gravação completa" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="conversa">
        <TabsList>
          <TabsTrigger value="conversa">
            Conversa ({call.conversation_turns?.length || 0} turnos)
          </TabsTrigger>
          <TabsTrigger value="transcricao">Transcrição</TabsTrigger>
        </TabsList>

        <TabsContent value="conversa">
          <Card>
            <CardContent className="pt-6">
              <ConversationTimeline turns={call.conversation_turns || []} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transcricao">
          <Card>
            <CardContent className="pt-6">
              <TranscriptViewer
                transcriptLocal={call.transcript_local}
                transcriptPt={call.transcript_pt}
                languageName="Idioma Local"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {call.agent_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas do Agente IA</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{call.agent_notes}</p>
          </CardContent>
        </Card>
      )}

      {call.error_message && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-base text-red-700">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">{call.error_message}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
