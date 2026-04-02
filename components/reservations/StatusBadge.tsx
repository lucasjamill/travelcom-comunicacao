import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  calling: {
    label: 'Ligando',
    className: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  failed: {
    label: 'Falhou',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  review_needed: {
    label: 'Revisar',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}

const CALL_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  initiated: {
    label: 'Iniciada',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  in_progress: {
    label: 'Em andamento',
    className: 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse',
  },
  completed: {
    label: 'Concluída',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  failed: {
    label: 'Falhou',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
}

export function CallStatusBadge({ status }: { status: string }) {
  const config = CALL_STATUS_CONFIG[status] || CALL_STATUS_CONFIG.initiated
  return (
    <Badge variant="outline" className={cn('font-medium', config.className)}>
      {config.label}
    </Badge>
  )
}
