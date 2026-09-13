'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { getMedia } from '@/lib/harbor/media'

export function useMediaUrl(id?: string) {
 const { data, error } = useSWR(id ? ['harbor-media', id] : null, () => getMedia(id!))
 const [url, setUrl] = useState<string>()
 useEffect(() => { if (!data) return; const next = URL.createObjectURL(data); setUrl(next); return () => URL.revokeObjectURL(next) }, [data])
 return { url, error }
}

export function LocalMedia({ id, kind, className }: { id: string; kind?: string; className?: string }) {
 const { url, error } = useMediaUrl(id)
 if (error) return <p className="small">This attachment could not be opened.</p>
 if (!url) return <p className="small">Opening your local attachment…</p>
 return kind === 'audio'
  ? <audio controls src={url} className="w-full"/>
  : <img src={url} alt="A little moment captured in this demo" className={className ?? 'w-full max-h-72 rounded-xl object-cover'}/>
}

export function LocalPhoto({ id, className }: { id: string; className?: string }) {
 const { url } = useMediaUrl(id)
 if (!url) return null
 return <img src={url} alt="" className={className}/>
}
