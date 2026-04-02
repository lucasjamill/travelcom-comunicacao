'use client'

import { useState } from 'react'
import { Phone, PhoneOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CallStatusBadge } from '@/components/reservations/StatusBadge'
import { toast } from 'sonner'

interface CallPanelProps {
  reservationId: string
  currentCallStatus?: string
  onCallInitiated?: () => void
}

export function CallPanel({ reservationId, currentCallStatus, onCallInitiated }: CallPanelProps) {
  const [loading, setLoading] = useState(false)

  async function handleInitiateCall() {
    setLoading(true)
    try {
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservationId }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao iniciar chamada')
      }

      toast.success('Chamada iniciada com sucesso!')
      onCallInitiated?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao iniciar chamada'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const isCallActive = currentCallStatus === 'initiated' || currentCallStatus === 'in_progress'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Controle de Chamada</CardTitle>
          {currentCallStatus && <CallStatusBadge status={currentCallStatus} />}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button
            onClick={handleInitiateCall}
            disabled={loading || isCallActive}
            className="flex-1"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Phone className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Iniciando...' : isCallActive ? 'Chamada em andamento' : 'Iniciar Chamada'}
          </Button>
          {isCallActive && (
            <Button variant="destructive" size="icon" disabled>
              <PhoneOff className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
