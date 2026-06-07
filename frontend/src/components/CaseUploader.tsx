import { useState } from 'react'
import { createTextCase, uploadCase } from '../lib/api'
import { Upload, Play, CheckCircle2, AlertCircle } from 'lucide-react'

const sampleText =
  'The complaint states that Rohan argued with the victim outside a shop at 8:30 PM. A witness says Rohan struck the victim with a metal rod. The victim later died in hospital. The defense says the witness was standing far away and could not clearly identify the attacker. Police recovered a rod, but the forensic report is inconclusive.'

type Props = {
  onCaseCreated: (caseId: string) => void
}

export function CaseUploader({ onCaseCreated }: Props) {
  const [title, setTitle] = useState('Sample Case: State v. Rohan')
  const [text, setText] = useState(sampleText)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  async function submitText() {
    setBusy(true)
    setMessage('')
    setIsSuccess(false)
    try {
      const result = await createTextCase(title, text)
      onCaseCreated(result.case_id)
      setIsSuccess(true)
      setMessage('Case submitted. AI agents are analyzing evidence...')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit case')
    } finally {
      setBusy(false)
    }
  }

  async function submitFile(file: File | null) {
    if (!file) return
    setBusy(true)
    setMessage('')
    setIsSuccess(false)
    try {
      const result = await uploadCase(file)
      onCaseCreated(result.case_id)
      setIsSuccess(true)
      setMessage('Document uploaded. Running multi-agent legal trace...')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not upload document')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="premium-glass p-7 flex flex-col gap-6">
      <div>
        <span className="text-[11px] font-semibold tracking-wider text-black/40 dark:text-white/40 uppercase block mb-1">
          Intake Terminal
        </span>
        <strong className="text-xl font-medium tracking-tight text-black dark:text-white block font-sans">
          Analyze Case Document
        </strong>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 leading-normal">
          Upload a court record (PDF/TXT) or run the pre-loaded trial.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Case Title</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full border border-gray-200 dark:border-white/5 rounded-xl px-4 py-2.5 text-[14px] text-black dark:text-white bg-black/2 dark:bg-white/2 focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black/10 transition-all font-sans"
            placeholder="e.g. State v. Rohan"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-semibold text-gray-700 dark:text-gray-300">Evidentiary Record / Case Text</label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full border border-gray-200 dark:border-white/5 rounded-xl px-4 py-3 text-[14px] text-black dark:text-white bg-black/2 dark:bg-white/2 focus:outline-none focus:border-black dark:focus:border-white focus:bg-white dark:focus:bg-black/10 transition-all font-sans min-h-[160px] resize-y"
            placeholder="Describe the complaint, witness statements, and forensic evidence..."
          />
        </div>
      </div>

      <div className="flex items-center gap-3 mt-1">
        <button
          onClick={submitText}
          disabled={busy || !text.trim()}
          className="flex-1 bg-[#176B87] dark:bg-[#45A987] hover:bg-[#115066] dark:hover:bg-[#328065] text-white dark:text-black py-3 px-6 rounded-full text-sm font-bold transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
        >
          <Play className="w-4 h-4 fill-current" />
          {busy ? 'Analyzing...' : 'Analyze Text'}
        </button>

        <label className="flex-1 border border-gray-200 dark:border-white/10 hover:border-black dark:hover:border-white text-black dark:text-white hover:bg-gray-50 dark:hover:bg-white/5 py-3 px-6 rounded-full text-sm font-bold transition-all duration-200 inline-flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]">
          <Upload className="w-4 h-4 text-gray-500" />
          <span>Upload File</span>
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(event) => submitFile(event.target.files?.[0] ?? null)}
            disabled={busy}
            className="hidden"
          />
        </label>
      </div>

      {message && (
        <div
          className={`flex items-start gap-2.5 p-3.5 rounded-xl border text-xs leading-relaxed ${
            isSuccess
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-[#45A987]'
              : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
          }`}
        >
          {isSuccess ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-[#45A987] mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          )}
          <span>{message}</span>
        </div>
      )}
    </div>
  )
}
