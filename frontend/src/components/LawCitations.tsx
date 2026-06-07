import { Book } from 'lucide-react'

type Props = {
  laws: Array<{ section: string; text: string; relevance?: number }>
}

export function LawCitations({ laws }: Props) {
  if (!laws.length) {
    return <p className="text-xs text-gray-500 italic">No citations retrieved.</p>
  }

  return (
    <div className="flex flex-col gap-2 mt-1 font-sans">
      {laws.map((law, index) => (
        <details
          key={`${law.section}-${index}`}
          open={index === 0}
          className="border border-gray-150 dark:border-white/5 rounded-xl overflow-hidden bg-white/40 dark:bg-white/2 shadow-[0_1px_3px_rgba(0,0,0,0.01)]"
        >
          <summary className="flex items-center justify-between p-3.5 cursor-pointer bg-black/2 dark:bg-white/2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors select-none text-xs font-semibold text-gray-800 dark:text-gray-200">
            <span className="flex items-center gap-2">
              <Book className="w-4 h-4 text-[#176B87] dark:text-[#45A987] shrink-0" />
              {law.section}
            </span>
            <span className="text-[10px] bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-305 font-bold px-2 py-0.5 rounded-full">
              Relevance {law.relevance ?? 0}
            </span>
          </summary>
          <p className="p-3.5 border-t border-gray-100 dark:border-white/5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed bg-white/10 dark:bg-black/10">
            {law.text}
          </p>
        </details>
      ))}
    </div>
  )
}
