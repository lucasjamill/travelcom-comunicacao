'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Phone, List, Settings, PlusCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'

const NAV_ITEMS = [
  { href: '/', label: 'Reservas', icon: List },
  { href: '/reservations/new', label: 'Nova Reserva', icon: PlusCircle },
  { href: '/admin/examples', label: 'Exemplos IA', icon: Settings },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen">
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6 border-b">
          <Link href="/" className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-bold text-lg leading-tight">TravelCom</h1>
              <p className="text-xs text-muted-foreground">Comunicacao</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground">
            TravelCom Viagens e Turismo
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-background">
        <div className="p-8">{children}</div>
      </main>
      <Toaster />
    </div>
  )
}
