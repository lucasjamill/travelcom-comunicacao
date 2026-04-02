'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TranscriptViewerProps {
  transcriptLocal: string | null
  transcriptPt: string | null
  languageName: string
}

export function TranscriptViewer({
  transcriptLocal,
  transcriptPt,
  languageName,
}: TranscriptViewerProps) {
  const [activeTab, setActiveTab] = useState('local')

  if (!transcriptLocal && !transcriptPt) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Transcrição não disponível
      </div>
    )
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        {transcriptLocal && <TabsTrigger value="local">{languageName}</TabsTrigger>}
        {transcriptPt && <TabsTrigger value="pt">Português</TabsTrigger>}
      </TabsList>
      {transcriptLocal && (
        <TabsContent value="local">
          <ScrollArea className="h-[400px]">
            <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-lg">
              {transcriptLocal}
            </div>
          </ScrollArea>
        </TabsContent>
      )}
      {transcriptPt && (
        <TabsContent value="pt">
          <ScrollArea className="h-[400px]">
            <div className="whitespace-pre-wrap text-sm leading-relaxed p-4 bg-muted rounded-lg">
              {transcriptPt}
            </div>
          </ScrollArea>
        </TabsContent>
      )}
    </Tabs>
  )
}
