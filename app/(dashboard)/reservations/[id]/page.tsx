'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Phone, RefreshCw, Loader2, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge, CallStatusBadge } from '@/components/reservations/StatusBadge'
import { getLanguageConfig } from '@/lib/utils/languages'
import { ReservationWithCalls, Call } from '@/types'

export default function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'roteiro'

  const [reservation, setReservation] = useState<ReservationWithCalls | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingScript, setGeneratingScript] = useState(false)
  const [initiatingCall, setInitiatingCall] = useState(false)

  async function fetchReservation() {
    try {
      const res = await fetch(`/api/reservations/${id}`)
      if (!res.ok) throw new Error('Reserva não encontrada')
      const data = await res.json()
      setReservation(data)
    } catch {
      toast.error('Erro ao carregar reserva')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReservation()
  }, [id])

  async function regenerateScript() {
    setGeneratingScript(true)
    try {
      const res = await fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: id }),
      })
      if (!res.ok) throw new Error('Erro ao gerar roteiro')
      toast.success('Roteiro regenerado com sucesso!')
      fetchReservation()
    } catch {
      toast.error('Erro ao regenerar roteiro')
    } finally {
      setGeneratingScript(false)
    }
  }

  async function initiateCall() {
    setInitiatingCall(true)
    try {
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: id }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao iniciar chamada')
      }
      toast.success('Chamada iniciada!')
      fetchReservation()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada'
      toast.error(message)
    } finally {
      setInitiatingCall(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (!reservation) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Reserva não encontrada</p>
      </div>
    )
  }

  const lang = getLanguageConfig(reservation.hotel_country)
  const latestScript = reservation.call_scripts?.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]

  const sortedCalls = [...(reservation.calls || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{reservation.hotel_name}</h1>
            <StatusBadge status={reservation.status} />
          </div>
          <p className="text-muted-foreground mt-1">
            {lang.flag} {reservation.guest_name} &middot; {reservation.localizador} &middot;{' '}
            {format(new Date(reservation.checkin_date), 'dd/MM/yyyy', { locale: ptBR })} -{' '}
            {format(new Date(reservation.checkout_date), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
        <Button onClick={initiateCall} disabled={initiatingCall}>
          {initiatingCall ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Phone className="h-4 w-4 mr-2" />
          )}
          {initiatingCall ? 'Ligando...' : 'Ligar Agora'}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Quarto</p>
            <p className="font-medium">{reservation.room_type || 'Standard'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Hóspedes</p>
            <p className="font-medium">{reservation.num_guests}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Pagamento</p>
            <p className="font-medium">
              {reservation.prepayment_status === 'paid' ? 'Pago' : reservation.prepayment_status === 'partial' ? 'Parcial' : 'Pendente'}
              {reservation.prepayment_amount && (
                <> &middot; {reservation.prepayment_amount} {reservation.prepayment_currency}</>
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Telefone</p>
            <p className="font-medium">{reservation.hotel_phone}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="roteiro">Roteiro</TabsTrigger>
          <TabsTrigger value="chamadas">Chamadas ({sortedCalls.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="roteiro" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" onClick={regenerateScript} disabled={generatingScript}>
              {generatingScript ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {generatingScript ? 'Gerando...' : 'Regenerar Roteiro'}
            </Button>
          </div>

          {latestScript ? (
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Roteiro em Português</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {latestScript.script_pt}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Roteiro em {lang.name} {lang.flag}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {latestScript.script_local}
                  </div>
                  {latestScript.audio_url && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-muted-foreground" />
                        <audio controls src={latestScript.audio_url} className="w-full h-8" />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">Nenhum roteiro gerado ainda</p>
                <Button onClick={regenerateScript} disabled={generatingScript}>
                  {generatingScript ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Gerar Roteiro
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="chamadas" className="space-y-4">
          {sortedCalls.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">Nenhuma chamada realizada</p>
                <Button onClick={initiateCall} disabled={initiatingCall}>
                  <Phone className="h-4 w-4 mr-2" />
                  Iniciar Primeira Chamada
                </Button>
              </CardContent>
            </Card>
          ) : (
            sortedCalls.map((call: Call, idx: number) => (
              <Card key={call.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Chamada #{sortedCalls.length - idx}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <CallStatusBadge status={call.status} />
                      {call.confirmation_number && (
                        <span className="text-sm font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded">
                          {call.confirmation_number}
                        </span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      {format(new Date(call.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                    {call.duration_seconds && (
                      <span>{Math.floor(call.duration_seconds / 60)}m {call.duration_seconds % 60}s</span>
                    )}
                  </div>

                  {call.recording_url && (
                    <div>
                      <p className="text-sm font-medium mb-1">Gravação</p>
                      <audio controls src={call.recording_url} className="w-full h-8" />
                    </div>
                  )}

                  {call.transcript_pt && (
                    <div>
                      <p className="text-sm font-medium mb-1">Transcrição (PT)</p>
                      <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
                        {call.transcript_pt}
                      </div>
                    </div>
                  )}

                  {call.agent_notes && (
                    <div>
                      <p className="text-sm font-medium mb-1">Notas do Agente</p>
                      <div className="bg-muted rounded-md p-3 text-sm">
                        {call.agent_notes}
                      </div>
                    </div>
                  )}

                  {call.error_message && (
                    <div className="bg-red-50 text-red-700 rounded-md p-3 text-sm">
                      {call.error_message}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
