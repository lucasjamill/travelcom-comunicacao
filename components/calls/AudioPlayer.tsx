'use client'

import { useRef, useState } from 'react'
import { Play, Pause, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface AudioPlayerProps {
  src: string
  label?: string
}

export function AudioPlayer({ src, label }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  function toggle() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={toggle}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
      <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <audio controls src={src} className="h-8 flex-1" />
    </div>
  )
}
