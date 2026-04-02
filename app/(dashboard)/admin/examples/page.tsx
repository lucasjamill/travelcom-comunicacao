'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { AgentExample } from '@/types'

const SCENARIO_LABELS: Record<string, string> = {
  confirmed: 'Confirmado',
  not_found: 'Não encontrado',
  transfer: 'Transferência',
  unclear: 'Não entendeu',
  special_request: 'Pedido especial',
}

const LANGUAGE_LABELS: Record<string, string> = {
  ja: 'Japonês',
  zh: 'Mandarim',
  th: 'Tailandês',
  ar: 'Árabe',
  ko: 'Coreano',
  en: 'Inglês',
  hi: 'Hindi',
  vi: 'Vietnamita',
  id: 'Indonésio',
}

export default function AdminExamplesPage() {
  const [examples, setExamples] = useState<AgentExample[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [label, setLabel] = useState('')
  const [languageCode, setLanguageCode] = useState('ja')
  const [scenarioType, setScenarioType] = useState('confirmed')
  const [turnsJson, setTurnsJson] = useState('[\n  {"role": "agent", "text": ""},\n  {"role": "hotel", "text": ""}\n]')
  const [expectedJson, setExpectedJson] = useState('{\n  "speak": "",\n  "speak_pt": "",\n  "status": "confirmed",\n  "confirmation_number": null,\n  "should_hangup": true\n}')

  const [filterLang, setFilterLang] = useState<string>('all')
  const [filterScenario, setFilterScenario] = useState<string>('all')

  async function fetchExamples() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('agent_examples')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setExamples(data || [])
    } catch {
      toast.error('Erro ao carregar exemplos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExamples()
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const supabase = createClient()
      const turns = JSON.parse(turnsJson)
      const expected = JSON.parse(expectedJson)

      const { error } = await supabase.from('agent_examples').insert({
        label,
        language_code: languageCode,
        scenario_type: scenarioType,
        conversation_turns: turns,
        expected_output: expected,
        is_active: true,
      })

      if (error) throw error

      toast.success('Exemplo adicionado!')
      setDialogOpen(false)
      resetForm()
      fetchExamples()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(id: string, currentlyActive: boolean) {
    const supabase = createClient()
    const { error } = await supabase
      .from('agent_examples')
      .update({ is_active: !currentlyActive })
      .eq('id', id)

    if (error) {
      toast.error('Erro ao atualizar')
      return
    }

    setExamples((prev) =>
      prev.map((e) => (e.id === id ? { ...e, is_active: !currentlyActive } : e))
    )
  }

  async function deleteExample(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('agent_examples').delete().eq('id', id)

    if (error) {
      toast.error('Erro ao excluir')
      return
    }

    toast.success('Exemplo excluído')
    setExamples((prev) => prev.filter((e) => e.id !== id))
  }

  function resetForm() {
    setLabel('')
    setLanguageCode('ja')
    setScenarioType('confirmed')
    setTurnsJson('[\n  {"role": "agent", "text": ""},\n  {"role": "hotel", "text": ""}\n]')
    setExpectedJson('{\n  "speak": "",\n  "speak_pt": "",\n  "status": "confirmed",\n  "confirmation_number": null,\n  "should_hangup": true\n}')
  }

  const filtered = examples.filter((e) => {
    if (filterLang !== 'all' && e.language_code !== filterLang) return false
    if (filterScenario !== 'all' && e.scenario_type !== filterScenario) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exemplos do Agente IA</h1>
          <p className="text-muted-foreground">
            Gerencie exemplos few-shot para calibrar o comportamento do agente
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Exemplo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Adicionar Exemplo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome do Exemplo</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Confirmação normal - Japão"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Idioma</Label>
                  <Select value={languageCode} onValueChange={(v) => v && setLanguageCode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGE_LABELS).map(([code, name]) => (
                        <SelectItem key={code} value={code}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de Cenário</Label>
                  <Select value={scenarioType} onValueChange={(v) => v && setScenarioType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Turnos da Conversa (JSON)</Label>
                <Textarea
                  value={turnsJson}
                  onChange={(e) => setTurnsJson(e.target.value)}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label>Resposta Esperada (JSON)</Label>
                <Textarea
                  value={expectedJson}
                  onChange={(e) => setExpectedJson(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <Button onClick={handleSave} disabled={saving || !label} className="w-full">
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {saving ? 'Salvando...' : 'Salvar Exemplo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <Select value={filterLang} onValueChange={(v) => v && setFilterLang(v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Idioma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos idiomas</SelectItem>
            {Object.entries(LANGUAGE_LABELS).map(([code, name]) => (
              <SelectItem key={code} value={code}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterScenario} onValueChange={(v) => v && setFilterScenario(v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cenário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos cenários</SelectItem>
            {Object.entries(SCENARIO_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {examples.length === 0
              ? 'Nenhum exemplo cadastrado. Os 4 exemplos padrão estão embutidos no código.'
              : 'Nenhum exemplo encontrado com os filtros selecionados.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((example) => (
            <Card key={example.id} className={!example.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{example.label}</CardTitle>
                    <Badge variant="outline">
                      {LANGUAGE_LABELS[example.language_code] || example.language_code}
                    </Badge>
                    <Badge variant="secondary">
                      {SCENARIO_LABELS[example.scenario_type] || example.scenario_type}
                    </Badge>
                    {!example.is_active && <Badge variant="destructive">Inativo</Badge>}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(example.id, example.is_active)}
                      title={example.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {example.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteExample(example.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Conversa</p>
                    <div className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap">
                      {example.conversation_turns
                        .map((t) => `[${t.role.toUpperCase()}]: ${t.text}`)
                        .join('\n')}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Resposta Esperada</p>
                    <div className="bg-muted rounded-md p-3 text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(example.expected_output, null, 2)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
