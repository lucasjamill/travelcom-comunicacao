import { ReservationForm } from '@/components/reservations/ReservationForm'

export default function NewReservationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nova Reserva</h1>
        <p className="text-muted-foreground">
          Cadastre os dados da reserva para gerar o roteiro e realizar a ligação
        </p>
      </div>
      <ReservationForm />
    </div>
  )
}
