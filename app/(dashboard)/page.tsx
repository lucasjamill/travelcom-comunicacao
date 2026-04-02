import { ReservationList } from '@/components/reservations/ReservationList'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PlusCircle } from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reservas</h1>
          <p className="text-muted-foreground">
            Gerencie e confirme reservas hoteleiras internacionais
          </p>
        </div>
        <Link href="/reservations/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Nova Reserva
          </Button>
        </Link>
      </div>
      <ReservationList />
    </div>
  )
}
