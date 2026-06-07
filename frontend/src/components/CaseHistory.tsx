import type { CaseSummary } from '../lib/api'
import { FolderOpen, Calendar, ChevronRight } from 'lucide-react'

type Props = {
  cases: CaseSummary[]
  activeCaseId: string
  onSelect: (caseId: string) => void
}

export function CaseHistory({ cases, activeCaseId, onSelect }: Props) {
  return (
    <div className="premium-glass p-7 flex flex-col gap-4">
      <div>
        <span className="text-[11px] font-semibold tracking-wider text-black/40 dark:text-white/40 uppercase block mb-1">
          Persistence
        </span>
        <strong className="text-xl font-medium tracking-tight text-black dark:text-white block font-sans">
          Case History
        </strong>
      </div>

      <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1 mt-2">
        {cases.length === 0 && (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm flex flex-col items-center justify-center gap-2">
            <FolderOpen className="w-8 h-8 text-gray-300 dark:text-gray-700" />
            <p>No trials simulated yet.</p>
          </div>
        )}
        {cases.map((item) => {
          const isActive = item.id === activeCaseId
          const statusText = item.verdict?.verdict ?? item.status
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 group cursor-pointer ${
                isActive
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white shadow-md'
                  : 'bg-black/2 dark:bg-white/2 text-black dark:text-white border-gray-100 dark:border-white/5 hover:bg-black/5 dark:hover:bg-white/5 hover:border-gray-200 dark:hover:border-white/10'
              }`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-semibold text-sm truncate pr-2 tracking-tight">
                  {item.title}
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span
                    className={`font-semibold uppercase tracking-wider ${
                      isActive
                        ? 'text-white/80 dark:text-black/80'
                        : statusText === 'Guilty'
                        ? 'text-emerald-600 dark:text-[#45A987]'
                        : statusText === 'Not Guilty'
                        ? 'text-[#176B87] dark:text-[#45A987]'
                        : 'text-amber-600 dark:text-amber-500'
                    }`}
                  >
                    {statusText}
                  </span>
                  <span className={isActive ? 'text-white/40 dark:text-black/40' : 'text-gray-400'}>•</span>
                  <span className={`inline-flex items-center gap-1 ${isActive ? 'text-white/60 dark:text-black/60' : 'text-gray-400 dark:text-gray-500'}`}>
                    <Calendar className="w-3 h-3" />
                    {new Date(item.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 ${
                  isActive ? 'text-white/60 dark:text-black/65' : 'text-gray-400 dark:text-gray-500'
                }`}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
