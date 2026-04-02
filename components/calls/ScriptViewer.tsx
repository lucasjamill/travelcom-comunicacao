'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CallScript } from '@/types'

interface ScriptViewerProps {
  script: CallScript
  languageName: string
  languageFlag: string
}

export function ScriptViewer({ script, languageName, languageFlag }: ScriptViewerProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Roteiro em Português</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {script.script_pt}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Roteiro em {languageName} {languageFlag}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {script.script_local}
          </div>
          {script.audio_url && (
            <>
              <Separator className="my-4" />
              <audio controls src={script.audio_url} className="w-full h-8" />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
