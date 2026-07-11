// 설교 백엔드(통합 프로젝트) API
import type { SermonNote } from './types'

const FN = 'https://xnomlgydifiqiybervtf.supabase.co/functions/v1/sermon'
const KEY = 'sb_publishable_oLtieT_jw7Gjb8etEsy0jw_thBaDjl-'

export async function getSermons(): Promise<SermonNote[]> {
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
    body: JSON.stringify({ action: 'getSermons' }),
  })
  const j = await r.json()
  if (!j.ok) throw new Error(j.error || 'getSermons 실패')
  return (j.sermons || []) as SermonNote[]
}
