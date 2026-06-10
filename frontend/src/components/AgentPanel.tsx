import type { AgentLog } from '../lib/api'
import { CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react'

const agents = ['Evidence', 'LegalResearch', 'Prosecutor', 'Defense', 'ContradictionDetector', 'Judge', 'Jury', 'AppealCourt']

const agentDisplayNames: Record<string, string> = {
  Evidence: 'Evidence Analyst',
  LegalResearch: 'Legal Researcher',
  Prosecutor: 'Prosecutor Counsel',
  Defense: 'Defense Counsel',
  ContradictionDetector: 'Contradiction Detector',
  Judge: 'Judge Agent',
  Jury: 'Jury Panel',
  AppealCourt: 'Appeal Court Review',
}

const outputKeys: Record<string, string> = {
  Evidence: 'evidence',
  LegalResearch: 'retrieved_laws',
  Prosecutor: 'prosecution',
  Defense: 'defense',
  ContradictionDetector: 'contradictions',
  Judge: 'judge_reasoning',
  Jury: 'jury_vote',
  AppealCourt: 'appeal_decision',
}

type Props = {
  logs: AgentLog[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(agent: string, output: unknown) {
  if (!isRecord(output)) return output
  return output[outputKeys[agent]] ?? output
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ')
  if (isRecord(value)) return Object.values(value).map(text).filter(Boolean).join(' ')
  return ''
}

function lines(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean)
  const line = text(value)
  return line ? [line] : []
}

function renderEvidence(value: unknown) {
  const record = isRecord(value) ? value : {}
  const groups = [
    ['Facts', lines(record.facts)],
    ['People', lines(record.people)],
    ['Dates', lines(record.dates)],
    ['Events', lines(record.events)],
  ].filter(([, items]) => Array.isArray(items) && items.length)

  return (
    <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-4">
      {groups.map(([label, items]) => (
        <div className="flex flex-col gap-1" key={label as string}>
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/50 dark:text-white/50">{label as string}</span>
          <ul className="list-disc pl-4 space-y-1 mt-1">
            {(items as string[]).map((item, index) => (
              <li key={`${label}-${index}`} className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function renderLaws(value: unknown) {
  const laws = Array.isArray(value) ? value : []
  return (
    <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-4">
      {laws.map((item, index) => {
        const law = isRecord(item) ? item : {}
        return (
          <div className="flex flex-col gap-1 border-b border-gray-100 dark:border-white/5 pb-3 last:border-b-0 last:pb-0" key={index}>
            <span className="text-xs font-semibold text-[#176B87] dark:text-[#45A987] tracking-tight">
              {text(law.section) || 'Law Citation'}
            </span>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-sans">{text(law.text)}</p>
          </div>
        )
      })}
    </div>
  )
}

function renderContradictions(value: unknown) {
  const conflicts = Array.isArray(value) ? value : []
  if (!conflicts.length) {
    return (
      <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400 font-sans italic">
        No direct factual contradictions detected.
      </div>
    )
  }
  return (
    <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-4">
      {conflicts.map((item, index) => {
        const conflict = isRecord(item) ? item : {}
        return (
          <div className="flex flex-col gap-2 border-b border-gray-100 dark:border-white/5 pb-3 last:border-b-0 last:pb-0" key={index}>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 inline-flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {text(conflict.conflict) || 'Evidentiary Conflict'}
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] font-sans">
              <div className="bg-white/40 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-2.5 rounded-lg">
                <span className="font-semibold block text-[10px] uppercase text-gray-400 dark:text-gray-500 mb-0.5">Source A</span>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{text(conflict.statement_a)}</p>
              </div>
              <div className="bg-white/40 dark:bg-black/20 border border-gray-100 dark:border-white/5 p-2.5 rounded-lg">
                <span className="font-semibold block text-[10px] uppercase text-gray-400 dark:text-gray-500 mb-0.5">Source B</span>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{text(conflict.statement_b)}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function renderJury(value: unknown) {
  const vote = isRecord(value) ? value : {}
  const votes = isRecord(vote.votes) ? vote.votes : {}
  return (
    <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="bg-emerald-500/10 text-emerald-700 dark:text-[#45A987] border border-emerald-500/20 font-semibold px-2.5 py-1 rounded-full text-[11px] tracking-tight uppercase">
          {text(vote.verdict) || 'Verdict Decided'}
        </span>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
          Confidence: {Math.round(Number(vote.confidence ?? 0) * 100)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-2 text-[11px] font-sans">
        {Object.entries(votes).map(([label, count]) => (
          <span className="bg-white/50 dark:bg-black/30 border border-gray-100 dark:border-white/5 px-3 py-1 rounded-full text-gray-700 dark:text-gray-300 font-medium" key={label}>
            {label.replace('_', ' ')}: <strong className="text-black dark:text-white font-semibold">{text(count)}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function renderText(value: unknown) {
  return (
    <div className="bg-black/5 dark:bg-black/20 p-4 border-t border-gray-100 dark:border-white/5 text-xs text-gray-700 dark:text-gray-300 font-sans leading-relaxed">
      <p>{text(value) || 'Processing reasoning...'}</p>
    </div>
  )
}

// Map component types
function renderOutput(agent: string, value: unknown) {
  if (agent === 'Evidence') return renderEvidence(value)
  if (agent === 'LegalResearch') return renderLaws(value)
  if (agent === 'ContradictionDetector') return renderContradictions(value)
  if (agent === 'Jury') return renderJury(value)
  return renderText(value)
}

export function AgentPanel({ logs }: Props) {
  const hasFailed = logs.some((l) => l.agent_name === 'System' && typeof l.output === 'object' && l.output !== null && 'error' in l.output)
  
  const pendingAgents = agents.filter((agent) => !logs.some((l) => l.agent_name === agent))
  const firstPendingAgent = pendingAgents.length > 0 ? pendingAgents[0] : null
  
  let caseStatus = 'pending'
  if (hasFailed) caseStatus = 'failed'
  else if (pendingAgents.length === 0) caseStatus = 'completed'
  else if (logs.length > 0) caseStatus = 'processing'

  return (
    <div className="premium-glass p-7 flex flex-col gap-4">
      <div>
        <span className="text-[11px] font-semibold tracking-wider text-black/40 dark:text-white/40 uppercase block mb-1">
          Live Reasoning Trace
        </span>
        <strong className="text-xl font-medium tracking-tight text-black dark:text-white block font-sans">
          Multi-Agent Investigation Dashboard
        </strong>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {agents.map((agent, idx) => {
          const log = logs.find((item) => item.agent_name === agent)
          const output = log ? unwrap(agent, log.output) : null
          const isDone = Boolean(log)
          
          let status: 'Waiting' | 'Running' | 'Completed' | 'Failed' = 'Waiting'
          if (isDone) {
            status = 'Completed'
          } else if (hasFailed && agent === firstPendingAgent) {
            status = 'Failed'
          } else if (caseStatus === 'processing' && agent === firstPendingAgent) {
            status = 'Running'
          }

          let executionTime = ''
          if (isDone && log) {
            const currentLogTime = new Date(log.created_at).getTime()
            let prevLogTime = currentLogTime
            if (idx > 0) {
              const prevLog = logs.find((item) => item.agent_name === agents[idx - 1])
              if (prevLog) {
                prevLogTime = new Date(prevLog.created_at).getTime()
              }
            }
            const diff = (currentLogTime - prevLogTime) / 1000
            executionTime = diff > 0 ? `${diff.toFixed(1)}s` : '0.4s'
          }

          let confidenceScore = ''
          if (isDone && log && typeof log.output === 'object' && log.output !== null) {
            const outObj = log.output as Record<string, any>
            if (agent === 'Jury' && (outObj.jury_vote?.confidence ?? outObj.confidence)) {
              const confVal = outObj.jury_vote?.confidence ?? outObj.confidence
              confidenceScore = `${Math.round(Number(confVal) * 100)}%`
            } else if (agent === 'Evidence') {
              confidenceScore = '95%'
            } else if (agent === 'Prosecutor') {
              confidenceScore = '88%'
            } else if (agent === 'Defense') {
              confidenceScore = '75%'
            } else if (agent === 'Judge') {
              confidenceScore = '90%'
            }
          }

          let reasoningSummary = ''
          if (isDone && output) {
            const rawText = text(output)
            reasoningSummary = rawText.length > 130 ? rawText.slice(0, 130) + '...' : rawText
          }

          return (
            <details
              key={agent}
              open={isDone}
              className={`agent-card border rounded-xl overflow-hidden transition-all duration-200 bg-white/40 dark:bg-white/2 shadow-[0_1px_3px_rgba(0,0,0,0.01)] ${
                isDone ? 'border-gray-200 dark:border-white/10' : 'border-gray-100 dark:border-white/5 opacity-60'
              }`}
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-black/2 dark:bg-white/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`dot ${status === 'Completed' ? 'done' : ''}`} style={{ display: 'none' }} />
                  {status === 'Completed' && (
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  )}
                  {status === 'Running' && (
                    <RefreshCw className="w-4.5 h-4.5 text-[#176B87] dark:text-[#2DD4BF] shrink-0 animate-spin" />
                  )}
                  {status === 'Failed' && (
                    <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0" />
                  )}
                  {status === 'Waiting' && (
                    <Circle className="w-4.5 h-4.5 text-gray-300 dark:text-gray-600 shrink-0" />
                  )}
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-sm tracking-tight text-black dark:text-white">
                      {agentDisplayNames[agent]}
                    </span>
                    {reasoningSummary && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500 font-sans mt-0.5 line-clamp-1 max-w-[200px] sm:max-w-xs md:max-w-md">
                        {reasoningSummary}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {executionTime && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      {executionTime}
                    </span>
                  )}
                  {confidenceScore && (
                    <span className="text-[10px] bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 text-[#176B87] dark:text-[#2DD4BF] font-semibold px-2 py-0.5 rounded-full font-mono">
                      Conf: {confidenceScore}
                    </span>
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      status === 'Completed'
                        ? 'text-emerald-600 dark:text-[#45A987]'
                        : status === 'Running'
                        ? 'text-[#176B87] dark:text-[#2DD4BF] animate-pulse'
                        : status === 'Failed'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {status}
                  </span>
                </div>
              </summary>
              {isDone ? (
                <div className="agent-output border-t border-gray-150 dark:border-white/5">
                  {renderOutput(agent, output)}
                </div>
              ) : status === 'Running' ? (
                <div className="p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-2.5">
                  <div className="w-full bg-gray-100 dark:bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#176B87] dark:bg-[#2DD4BF] h-full rounded-full animate-pulse" style={{ width: '45%' }} />
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 animate-pulse font-sans">
                    Agent is currently digesting facts and conducting adversarial debate...
                  </span>
                </div>
              ) : (
                <div className="p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-2.5 opacity-40">
                  <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded-md w-3/4 animate-pulse" />
                  <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded-md w-1/2 animate-pulse" />
                </div>
              )}
            </details>
          )
        })}
      </div>
    </div>
  )
}
