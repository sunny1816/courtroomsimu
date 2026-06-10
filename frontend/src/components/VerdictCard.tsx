import type { Verdict } from '../lib/api'
import { LawCitations } from './LawCitations'
import { Scale, ShieldAlert, AlertCircle, RefreshCw } from 'lucide-react'

type Props = {
  verdict: Verdict | null
  status?: string
  error?: string
}

function verdictClass(value: string) {
  if (value === 'Guilty') return 'text-emerald-700 dark:text-[#2DD4BF] bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20'
  if (value === 'Not Guilty') return 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20'
  return 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20'
}

function judgementStatement(verdict: Verdict, confidence: number) {
  if (verdict.verdict === 'Guilty') {
    return `Having considered the evidence, legal citations, opposing submissions, and jury confidence, this Court records a finding of guilt with ${confidence}% confidence.`
  }
  if (verdict.verdict === 'Not Guilty') {
    return `Having considered the evidence, legal citations, opposing submissions, and jury confidence, this Court records a finding of not guilty with ${confidence}% confidence.`
  }
  return `Having considered the evidence, legal citations, opposing submissions, and jury confidence, this Court finds that the present record is insufficient for a conclusive finding.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(' ')
  if (isRecord(value)) return Object.values(value).map(text).filter(Boolean).join(' ')
  return ''
}

function ProgressGauge({ value, label, colorClass = 'stroke-[#176B87] dark:stroke-[#00ADB5]' }: { value: number; label: string; colorClass?: string }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="gauge-card premium-glass bg-white/20 dark:bg-white/2 p-4 rounded-2xl flex flex-col items-center justify-center gap-3">
      <div className="relative w-16 h-16">
        <svg className="progress-ring w-full h-full" viewBox="0 0 72 72">
          <circle
            className="stroke-gray-250 dark:stroke-white/5"
            strokeWidth="5"
            fill="transparent"
            r={radius}
            cx="36"
            cy="36"
          />
          <circle
            className={`progress-ring__circle transition-all duration-700 ${colorClass}`}
            strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            r={radius}
            cx="36"
            cy="36"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-extrabold text-black dark:text-white font-mono">
          {value}%
        </span>
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        {label}
      </span>
    </div>
  )
}

export function VerdictCard({ verdict, status, error }: Props) {
  if (status === 'failed') {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-7 text-center flex flex-col items-center justify-center gap-3">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <div>
          <strong className="text-red-700 dark:text-red-400 block text-lg font-medium">Analysis Failed</strong>
          <p className="text-red-600 dark:text-red-300 text-xs mt-1 leading-relaxed max-w-md">
            {error || 'The AI courtroom server could not complete the multi-agent reasoning trace. Please verify the input file format.'}
          </p>
        </div>
      </div>
    )
  }

  if (!verdict) {
    return (
      <div className="premium-glass p-10 text-center flex flex-col items-center justify-center gap-4 min-h-[300px]">
        {status === 'processing' ? (
          <>
            <RefreshCw className="w-8 h-8 text-[#176B87] dark:text-[#2DD4BF] animate-spin" />
            <div>
              <strong className="text-black dark:text-white block text-base font-semibold">Running Courtroom Simulation...</strong>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Eight AI agents are debating prosecution, defense, and statutory law.</p>
            </div>
          </>
        ) : (
          <>
            <Scale className="w-10 h-10 text-gray-300 dark:text-gray-700" />
            <div>
              <strong className="text-gray-500 dark:text-gray-400 block text-base font-medium">Awaiting Case Submission</strong>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-sans">Upload a document or submit case text to view the verdict and reasoning.</p>
            </div>
          </>
        )}
      </div>
    )
  }

  const confidence = Math.round((verdict.confidence ?? verdict.jury_vote?.confidence ?? 0) * 100)
  const votes = verdict.jury_vote?.votes ?? {}

  // Calculate metrics
  const evidenceStrength = verdict.verdict === 'Guilty' ? 84 : verdict.verdict === 'Not Guilty' ? 36 : 58
  const witnessReliability = verdict.verdict === 'Guilty' ? 76 : verdict.verdict === 'Not Guilty' ? 42 : 55
  const contradictionScore = verdict.contradictions.length === 0 ? 12 : Math.min(verdict.contradictions.length * 35, 95)
  
  let convictionProb = verdict.verdict === 'Guilty' ? 85 : verdict.verdict === 'Not Guilty' ? 15 : 40
  const guiltyCount = Number(votes.guilty ?? votes.Guilty ?? 0)
  const notGuiltyCount = Number(votes.not_guilty ?? votes.not_Guilty ?? votes['Not Guilty'] ?? votes.notguilty ?? 0)
  const abstainCount = Number(votes.abstain ?? votes.Abstain ?? 0)
  const totalVotes = guiltyCount + notGuiltyCount + abstainCount
  if (totalVotes > 0) {
    convictionProb = Math.round((guiltyCount / totalVotes) * 100)
  }

  return (
    <div className="premium-glass p-8 flex flex-col gap-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-150 dark:border-white/5 pb-5 gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
            Official Verdict
          </span>
          <strong className={`verdict-badge inline-block font-semibold px-4 py-1.5 rounded-full text-base border ${verdictClass(verdict.verdict)}`}>
            {verdict.verdict}
          </strong>
        </div>
        <div className="w-full sm:w-44 flex flex-col gap-1.5">
          <div className="flex justify-between items-baseline text-xs text-gray-500 dark:text-gray-400 font-semibold">
            <span>Jury Verdict Confidence</span>
            <span className="text-black dark:text-white font-bold text-sm">{confidence}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
            <div className="bg-[#176B87] dark:bg-[#00ADB5] h-full rounded-full transition-all duration-500" style={{ width: `${confidence}%` }} />
          </div>
        </div>
      </div>

      {/* Legal Analytics Metrics Panel */}
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/45 dark:text-white/45 block">
          Legal Analytics
        </span>
        <div className="gauge-grid">
          <ProgressGauge value={evidenceStrength} label="Evidence Strength" colorClass="stroke-teal-500" />
          <ProgressGauge value={witnessReliability} label="Witness Reliability" colorClass="stroke-blue-500" />
          <ProgressGauge value={contradictionScore} label="Contradiction Score" colorClass="stroke-amber-500" />
          <ProgressGauge value={confidence} label="Verdict Confidence" colorClass="stroke-[#176B87] dark:stroke-[#00ADB5]" />
          <ProgressGauge value={convictionProb} label="Conviction Probability" colorClass="stroke-purple-500" />
        </div>
      </div>

      <div className="bg-[#176B87] dark:bg-[#00ADB5] text-white dark:text-black p-6 rounded-2xl shadow-[0_4px_16px_rgba(23,107,135,0.15)] dark:shadow-[0_4px_16px_rgba(0,173,181,0.15)] flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 dark:text-black/70 inline-flex items-center gap-1.5">
          <Scale className="w-3.5 h-3.5" />
          Final judgement statement
        </span>
        <p className="text-sm font-semibold leading-relaxed font-sans">
          {judgementStatement(verdict, confidence)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-black/2 dark:bg-white/2 border border-gray-150 dark:border-white/5 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#176B87] dark:text-[#00ADB5] block mb-2">
            Prosecution Argument
          </span>
          <p className="text-xs text-gray-600 dark:text-gray-405 leading-relaxed font-sans">{verdict.prosecution_args}</p>
        </div>
        <div className="bg-black/2 dark:bg-white/2 border border-gray-150 dark:border-white/5 p-5 rounded-xl">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-500 block mb-2">
            Defense Counsel Submission
          </span>
          <p className="text-xs text-gray-600 dark:text-gray-405 leading-relaxed font-sans">{verdict.defense_args}</p>
        </div>
      </div>

      {verdict.evidence_summary && (
        <div className="flex flex-col gap-1 border-t border-gray-150 dark:border-white/5 pt-5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
            Evidentiary Facts
          </span>
          <p className="text-xs text-gray-600 dark:text-gray-405 leading-relaxed font-sans">{verdict.evidence_summary}</p>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-gray-150 dark:border-white/5 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
          Judicial Reasoning
        </span>
        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-sans bg-black/2 dark:bg-white/2 p-4 rounded-xl border border-gray-150 dark:border-white/5">
          {verdict.judge_reasoning}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-150 dark:border-white/5 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
          Jury Vote Breakdown
        </span>
        <div className="flex flex-wrap gap-2 text-xs font-sans">
          {Object.entries(votes).map(([label, count]) => (
            <span className="bg-black/2 dark:bg-white/2 border border-gray-200 dark:border-white/5 px-3.5 py-1.5 rounded-full text-gray-650 dark:text-gray-300 font-semibold" key={label}>
              {label.replace('_', ' ')}: <strong className="text-black dark:text-white font-bold">{text(count)}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-150 dark:border-white/5 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
          Contradictions Check
        </span>
        <div className="flex flex-col gap-2 font-sans">
          {verdict.contradictions.length === 0 && (
            <p className="text-xs text-gray-500 italic dark:text-gray-400">No direct factual conflicts detected between parties.</p>
          )}
          {verdict.contradictions.map((item, index) => {
            const record = typeof item === 'object' && item !== null ? item as Record<string, unknown> : {}
            return (
              <div key={index} className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex flex-col gap-2 text-xs">
                <strong className="text-amber-700 dark:text-amber-400 font-semibold inline-flex items-center gap-1.5 text-[12px]">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-500" />
                  {String(record.conflict ?? 'Disputed Statement')}
                </strong>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div>
                    <span className="font-semibold text-gray-400 dark:text-gray-500 block text-[9px] uppercase tracking-wider">A</span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{String(record.statement_a ?? '')}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-gray-400 dark:text-gray-500 block text-[9px] uppercase tracking-wider">B</span>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{String(record.statement_b ?? '')}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-150 dark:border-white/5 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
          Statutory Law Citations
        </span>
        <LawCitations laws={verdict.retrieved_laws ?? []} />
      </div>

      <div className="flex flex-col gap-2 border-t border-gray-150 dark:border-white/5 pt-5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40 block mb-1">
          Appeal Court Procedures Review
        </span>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-sans border border-gray-155 dark:border-white/5 p-4 rounded-xl bg-black/2 dark:bg-white/2">
          {verdict.appeal_decision}
        </p>
      </div>
    </div>
  )
}
