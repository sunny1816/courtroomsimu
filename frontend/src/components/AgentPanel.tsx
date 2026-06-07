import type { AgentLog } from '../lib/api'
import { CheckCircle2, Circle, AlertCircle } from 'lucide-react'

const agents = ['Evidence', 'LegalResearch', 'Prosecutor', 'Defense', 'ContradictionDetector', 'Judge', 'Jury', 'AppealCourt']
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
  return (
    <div className="premium-glass p-7 flex flex-col gap-4">
      <div>
        <span className="text-[11px] font-semibold tracking-wider text-black/40 dark:text-white/40 uppercase block mb-1">
          Live Reasoning Trace
        </span>
        <strong className="text-xl font-medium tracking-tight text-black dark:text-white block font-sans">
          Agent Progress Graph
        </strong>
      </div>

      <div className="flex flex-col gap-3 mt-2">
        {agents.map((agent) => {
          const log = logs.find((item) => item.agent_name === agent)
          const output = log ? unwrap(agent, log.output) : null
          const isDone = Boolean(log)
          return (
            <details
              key={agent}
              open={isDone}
              className={`border rounded-xl overflow-hidden transition-all duration-200 bg-white/40 dark:bg-white/2 shadow-[0_1px_3px_rgba(0,0,0,0.01)] ${
                isDone ? 'border-gray-200 dark:border-white/10' : 'border-gray-100 dark:border-white/5 opacity-60'
              }`}
            >
              <summary className="flex items-center justify-between p-4 cursor-pointer select-none bg-black/2 dark:bg-white/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4.5 h-4.5 text-gray-300 dark:text-gray-600 shrink-0 animate-pulse" />
                  )}
                  <span className="font-semibold text-sm tracking-tight text-black dark:text-white">
                    {agent.replace(/([A-Z])/g, ' $1').trim()}
                  </span>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDone ? 'text-emerald-600 dark:text-[#45A987]' : 'text-gray-400 dark:text-gray-500'}`}>
                  {isDone ? 'Done' : 'Waiting'}
                </span>
              </summary>
              {isDone ? (
                renderOutput(agent, output)
              ) : (
                <div className="p-4 border-t border-gray-100 dark:border-white/5 flex flex-col gap-2.5 animate-pulse">
                  <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded-md w-3/4" />
                  <div className="h-3.5 bg-gray-100 dark:bg-white/5 rounded-md w-1/2" />
                </div>
              )}
            </details>
          )
        })}
      </div>
    </div>
  )
}
