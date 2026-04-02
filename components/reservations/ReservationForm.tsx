'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { COUNTRIES, getLanguageConfig } from '@/lib/utils/languages'

const formSchema = z.object({
  localizador: z.string().optional(),
  guest_name: z.string().min(1, 'Nome do hóspede é obrigatório'),
  hotel_name: z.string().min(1, 'Nome do hotel é obrigatório'),
  hotel_phone: z.string().min(5, 'Telefone do hotel é obrigatório'),
  hotel_country: z.string().min(1, 'País é obrigatório'),
  checkin_date: z.string().min(1, 'Data de check-in é obrigatória'),
  checkout_date: z.string().min(1, 'Data de check-out é obrigatória'),
  room_type: z.string().optional(),
  bed_type: z.string().optional(),
  board_type: z.enum(['breakfast', 'no_breakfast', 'all_inclusive', 'full_board', 'half_board']),
  num_guests: z.coerce.number().min(1),
  estimated_arrival: z.string().optional(),
  prepayment_status: z.enum(['paid', 'pending', 'partial']),
  prepayment_amount: z.coerce.number().optional(),
  prepayment_currency: z.string(),
  special_requests: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function ReservationForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as never,
    defaultValues: {
      num_guests: 1,
      board_type: 'breakfast',
      prepayment_status: 'paid',
      prepayment_currency: 'BRL',
    },
  })

  const selectedCountry = form.watch('hotel_country')
  const detectedLang = selectedCountry ? getLanguageConfig(selectedCountry) : null

  async function onSubmit(values: FormValues) {
    setSaving(true)
    try {
      const lang = getLanguageConfig(values.hotel_country)
      const payload = {
        ...values,
        hotel_language: lang.code,
        localizador: values.localizador || null,
        room_type: values.room_type || null,
        bed_type: values.bed_type || null,
        estimated_arrival: values.estimated_arrival || null,
        prepayment_amount: values.prepayment_amount || null,
        special_requests: values.special_requests || null,
      }

      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro ao criar reserva')
      }

      const reservation = await res.json()

      toast.success('Reserva criada com sucesso!')
      toast.info('Gerando roteiro automaticamente...')

      fetch('/api/scripts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: reservation.id }),
      }).then(() => {
        toast.success('Roteiro gerado!')
      }).catch(() => {
        toast.error('Erro ao gerar roteiro. Tente novamente na página da reserva.')
      })

      router.push(`/reservations/${reservation.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao criar reserva'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados da Reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="localizador"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Localizador (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: BKG-2024-001 (deixe vazio se não tiver)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guest_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Hóspede</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="checkin_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-in</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="checkout_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check-out</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="room_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Quarto</FormLabel>
                      <FormControl>
                        <Input placeholder="Standard, Deluxe..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="num_guests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hóspedes</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="bed_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Cama</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 1 Double Bed, 2 Twin Beds, 1 King Bed..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="board_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Regime de Alimentação</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="breakfast">Café da manhã incluso</SelectItem>
                        <SelectItem value="no_breakfast">Sem café da manhã</SelectItem>
                        <SelectItem value="half_board">Meia pensão</SelectItem>
                        <SelectItem value="full_board">Pensão completa</SelectItem>
                        <SelectItem value="all_inclusive">All Inclusive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimated_arrival"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horário de Chegada (Late Check-in)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 23:00, After midnight, 1AM..." {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Se preenchido, o agente informará o hotel para evitar cancelamento por no-show
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dados do Hotel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="hotel_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Hotel</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do hotel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hotel_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone (com DDI)</FormLabel>
                    <FormControl>
                      <Input placeholder="+81 3 1234 5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hotel_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>País do Hotel</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o país" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    {detectedLang && (
                      <p className="text-xs text-muted-foreground">
                        Idioma detectado: {detectedLang.flag} {detectedLang.name}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="prepayment_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status do Pré-pagamento</FormLabel>
                    <Select onValueChange={(v) => v && field.onChange(v)} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="partial">Parcial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="prepayment_amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="prepayment_currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Moeda</FormLabel>
                      <Select onValueChange={(v) => v && field.onChange(v)} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="BRL">BRL</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="JPY">JPY</SelectItem>
                          <SelectItem value="CNY">CNY</SelectItem>
                          <SelectItem value="THB">THB</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="KRW">KRW</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pedidos Especiais</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="special_requests"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Ex: Quarto andar alto, cama extra, late check-out..."
                        rows={5}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} size="lg">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {saving ? 'Salvando...' : 'Criar Reserva e Gerar Roteiro'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
