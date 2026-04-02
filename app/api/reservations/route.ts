import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { ReservationInsert } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)

    const status = searchParams.get('status')
    const country = searchParams.get('country')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let query = supabase
      .from('reservations')
      .select('*, calls(id, status, created_at, confirmation_number)')
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (country) query = query.eq('hotel_country', country)
    if (from) query = query.gte('checkin_date', from)
    if (to) query = query.lte('checkin_date', to)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const body: ReservationInsert = await request.json()

    const { data, error } = await supabase
      .from('reservations')
      .insert(body)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao criar reserva'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
