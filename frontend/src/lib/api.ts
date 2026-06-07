const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type AgentLog = {
  id: string
  case_id: string
  agent_name: string
  output: unknown
  created_at: string
}

export type Verdict = {
  case_id: string
  verdict: string
  confidence: number
  evidence_summary?: string
  prosecution_args: string
  defense_args: string
  contradictions: unknown[]
  retrieved_laws: Array<{ section: string; text: string; relevance?: number }>
  judge_reasoning: string
  jury_vote: { confidence?: number; votes?: Record<string, number>; verdict?: string }
  appeal_decision: string
}

export type CaseSummary = {
  id: string
  title: string
  status: string
  created_at: string
  verdict?: Verdict
}

export async function createTextCase(title: string, text: string) {
  const response = await fetch(`${API_URL}/api/v1/cases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, text }),
  })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<{ case_id: string; status: string }>
}

export async function uploadCase(file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch(`${API_URL}/api/v1/upload`, { method: 'POST', body })
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<{ case_id: string; status: string }>
}

export async function getVerdict(caseId: string) {
  const response = await fetch(`${API_URL}/api/v1/verdict/${caseId}`)
  if (!response.ok) throw new Error(await response.text())
  return response.json()
}

export async function getLogs(caseId: string) {
  const response = await fetch(`${API_URL}/api/v1/logs/${caseId}`)
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<AgentLog[]>
}

export async function getCases() {
  const response = await fetch(`${API_URL}/api/v1/cases`)
  if (!response.ok) throw new Error(await response.text())
  return response.json() as Promise<CaseSummary[]>
}
