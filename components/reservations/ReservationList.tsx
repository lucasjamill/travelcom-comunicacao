'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Phone, Eye, RotateCw } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from './StatusBadge'
import { getLanguageConfig } from '@/lib/utils/languages'
import { Reservation } from '@/types'

interface ReservationWithCalls extends Reservation {
  calls?: { id: string; status: string; created_at: string; confirmation_number: string | null }[]
}

export function ReservationList() {
  const [reservations, setReservations] = useState<ReservationWithCalls[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [countryFilter, setCountryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')

  async function fetchReservations() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (countryFilter !== 'all') params.set('country', countryFilter)

      const res = await fetch(`/api/reservations?${params}`)
      const data = await res.json()
      if (Array.isArray(data)) setReservations(data)
    } catch {
      // Error handled silently
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReservations()
  }, [statusFilter, countryFilter])

  const filtered = reservations.filter((r) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (r.localizador || '').toLowerCase().includes(q) ||
      r.guest_name.toLowerCase().includes(q) ||
      r.hotel_name.toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por localizador, hóspede ou hotel..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="calling">Ligando</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="review_needed">Revisar</SelectItem>
          </SelectContent>
        </Select>
        <Select value={countryFilter} onValueChange={(v) => v && setCountryFilter(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="País" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="JP">Japão</SelectItem>
            <SelectItem value="CN">China</SelectItem>
            <SelectItem value="TH">Tailândia</SelectItem>
            <SelectItem value="AE">Emirados</SelectItem>
            <SelectItem value="KR">Coreia</SelectItem>
            <SelectItem value="IN">Índia</SelectItem>
            <SelectItem value="VN">Vietnã</SelectItem>
            <SelectItem value="ID">Indonésia</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchReservations}>
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Localizador</TableHead>
              <TableHead>Hóspede</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última Chamada</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma reserva encontrada
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => {
                const lang = getLanguageConfig(r.hotel_country)
                const lastCall = r.calls?.sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                )[0]
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-medium">{r.localizador || '—'}</TableCell>
                    <TableCell>{r.guest_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{lang.flag}</span>
                        <span>{r.hotel_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(r.checkin_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(r.checkout_date), 'dd/MM/yyyy', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lastCall
                        ? format(new Date(lastCall.created_at), "dd/MM HH:mm", { locale: ptBR })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/reservations/${r.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/reservations/${r.id}?tab=chamadas`}>
                          <Button variant="ghost" size="icon">
                            <Phone className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
