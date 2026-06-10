import { useEffect, useState, useRef } from 'react'
import { AgentPanel } from '../components/AgentPanel'
import { CaseHistory } from '../components/CaseHistory'
import { CaseUploader } from '../components/CaseUploader'
import { VerdictCard } from '../components/VerdictCard'
import { getCases, getLogs, getVerdict, type AgentLog, type CaseSummary, type Verdict } from '../lib/api'
import { supabase } from '../lib/supabase'
import { 
  ArrowRight, 
  Sun, 
  Moon, 
  Scale, 
  Play, 
  BookOpen, 
  Cpu, 
  ShieldAlert, 
  Gavel, 
  Briefcase, 
  Globe, 
  ExternalLink 
} from 'lucide-react'

function LogoIcon() {
  return (
    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[#176B87] to-[#2DD4BF] text-white shadow-md shadow-[#176B87]/20">
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    </div>
  )
}




function UseCaseCard({ title, desc, icon: Icon, videoUrl }: { title: string; desc: string; icon: any; videoUrl: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)

  const handleMouseEnter = () => {
    setPlaying(true)
    if (videoRef.current) {
      videoRef.current.play().catch(() => {})
    }
  }

  const handleMouseLeave = () => {
    setPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  return (
    <div 
      className="use-case-card relative overflow-hidden premium-glass p-8 flex flex-col gap-5 z-10 cursor-pointer min-h-[220px] justify-between group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video 
        ref={videoRef}
        src={videoUrl}
        className={`use-case-video-overlay absolute inset-0 w-full h-full object-cover z-0 pointer-events-none transition-opacity duration-500 ${playing ? 'opacity-10 dark:opacity-20' : 'opacity-0'}`}
        loop
        muted
        playsInline
      />
      <div className="relative z-10 flex flex-col gap-4">
        <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-[#176B87] dark:text-[#2DD4BF] transition-colors group-hover:bg-[#176B87]/10 dark:group-hover:bg-[#2DD4BF]/10">
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-semibold text-lg tracking-tight font-sans text-black dark:text-white transition-colors group-hover:text-[#176B87] dark:group-hover:text-[#2DD4BF]">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">{desc}</p>
        </div>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 text-xs font-semibold text-[#176B87] dark:text-[#2DD4BF] opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-5px] group-hover:translate-x-0">
        <span>Preview Simulation</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </div>
    </div>
  )
}

export function Home() {
  const [caseId, setCaseId] = useState('')
  const [logs, setLogs] = useState<AgentLog[]>([])
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [caseStatus, setCaseStatus] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('lexa-theme') === 'dark')
  const [scrolled, setScrolled] = useState(false)

  const simulatorRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const useCasesRef = useRef<HTMLDivElement>(null)

  async function refresh(id = caseId) {
    const caseList = await getCases()
    setCases(caseList)
    if (!id) return
    const selectedCase = caseList.find((item) => item.id === id)
    if (selectedCase?.status) setCaseStatus(selectedCase.status)
    const nextLogs = await getLogs(id)
    setLogs(nextLogs)
    const systemError = nextLogs.find((item) => item.agent_name === 'System')
    const output = systemError?.output
    if (typeof output === 'object' && output !== null && 'error' in output) {
      setAnalysisError(String((output as { error?: unknown }).error ?? ''))
    } else {
      setAnalysisError('')
    }
    const verdictResponse = await getVerdict(id)
    if (typeof verdictResponse?.status === 'string') setCaseStatus(verdictResponse.status)
    setVerdict(verdictResponse?.verdict === null ? null : verdictResponse)
    return verdictResponse?.status ?? selectedCase?.status
  }

  useEffect(() => {
    refresh().catch(console.error)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    localStorage.setItem('lexa-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    if (!caseId) return
    refresh(caseId).catch(console.error)
    const timer = window.setInterval(() => {
      refresh(caseId)
        .then((status) => {
          if (status === 'completed' || status === 'failed') window.clearInterval(timer)
        })
        .catch(console.error)
    }, 1200)
    return () => window.clearInterval(timer)
  }, [caseId])

  useEffect(() => {
    if (!caseId || !supabase) return
    const client = supabase
    const channel = client
      .channel('agent-progress')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_logs', filter: `case_id=eq.${caseId}` },
        (payload) => setLogs((current) => [...current, payload.new as AgentLog]),
      )
      .subscribe()
    return () => {
      client.removeChannel(channel)
    }
  }, [caseId])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function selectCase(id: string) {
    setCaseId(id)
    setVerdict(null)
    setCaseStatus('')
    setAnalysisError('')
    setLogs([])
    
    // Auto-scroll to workspace after case selection or upload
    setTimeout(() => {
      scrollToSimulator()
    }, 100)
  }

  const scrollToSimulator = () => {
    simulatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToFeatures = () => {
    featuresRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToUseCases = () => {
    useCasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Brand marquee mock lists
  const brandLogos = [
    { name: 'Stripe', path: 'M4 8v16h6V14h4v10h6V14c0-4-2.5-6-6-6H4z' },
    { name: 'Plaid', path: 'M4 4h24v6H4V4zm0 9h24v6H4v-6zm0 9h24v6H4v-6z' },
    { name: 'Visa', path: 'M4 8h5l3 11 3-11h5l-6 16H9L4 8z' },
    { name: 'Mastercard', path: 'M11 6a10 10 0 1 0 0 20 10 10 0 1 0 0-20z M21 6a10 10 0 1 0 0 20 10 10 0 1 0 0-20z' },
    { name: 'Coinbase', path: 'M16 4a12 12 0 1 0 12 12A12 12 0 0 0 16 4zm0 18a6 6 0 1 1 6-6 6 6 0 0 1-6 6z' },
    { name: 'Gemini', path: 'M6 10h20v2H6v-2zm0 10h20v2H6v-2z' },
    { name: 'Brex', path: 'M4 4h14a6 6 0 0 1 6 6v12h-6v-6H10v6H4V4zm6 6v2h8v-2h-8z' },
    { name: 'Revolut', path: 'M6 4h6l6 14v4h-6l-6-14V4zm14 0h6v12h-6V4z' }
  ]

  const backerLogos = [
    'Sequoia Capital', 'Y Combinator', 'Andreessen Horowitz', 'Founders Fund', 
    'Tiger Global', 'Accel Partners', 'Benchmark Capital', 'General Catalyst'
  ]

  return (
    <div className="relative min-h-screen overflow-hidden text-[#172033] dark:text-[#edf4f1] font-sans selection:bg-[#176B87]/20 selection:text-[#176B87] dark:selection:bg-[#2DD4BF]/20 dark:selection:text-[#2DD4BF]">
      
      {/* Background Radial Glow Effects */}
      <div className="absolute top-[20%] left-[-10%] w-[50vw] h-[50vw] halo-glow-orb opacity-40" />
      <div className="absolute top-[60%] right-[-10%] w-[50vw] h-[50vw] halo-glow-orb opacity-30" />

      {/* Floating Transparent Navbar */}
      <nav className={`navbar-container px-6 py-4 md:px-12 ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <LogoIcon />
            <span className="font-extrabold text-xl tracking-tight font-sans text-black dark:text-white">LEXA</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-gray-600 dark:text-gray-300">
            <button onClick={scrollToFeatures} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Features</button>
            <button onClick={scrollToUseCases} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Use Cases</button>
            <button onClick={scrollToSimulator} className="hover:text-black dark:hover:text-white transition-colors cursor-pointer">Simulator</button>
          </div>

          <div className="flex items-center gap-4">
            <button 
              className="w-10 h-10 rounded-full border border-gray-200 dark:border-white/5 flex items-center justify-center text-black dark:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" 
              type="button" 
              aria-label="Toggle theme" 
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button 
              onClick={scrollToSimulator}
              className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-100 px-5 py-2.5 rounded-full text-xs font-semibold tracking-tight transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Start Case
            </button>
          </div>
        </div>
      </nav>

      {/* Fullscreen Hero Section */}
      <header className="relative min-h-screen flex flex-col justify-center items-center px-6 text-center pt-24 overflow-hidden">
        {/* Abstract Loop Video Background */}
        <video 
          autoPlay 
          loop 
          muted 
          playsInline 
          className="hero-video-bg"
          src="https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-loop-41851-large.mp4"
        />
        <div className="hero-glow-layer" />

        <div className="max-w-4xl mx-auto flex flex-col items-center gap-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full premium-glass text-xs font-semibold tracking-tight text-[#176B87] dark:text-[#2DD4BF]">
            <Scale className="w-3.5 h-3.5" />
            <span>Autonomous Indian Courtroom intelligence</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.08] font-sans text-black dark:text-white">
            Simulate Courtroom Trials <br />
            <span className="bg-gradient-to-r from-[#176B87] via-[#2D9CA9] to-[#2DD4BF] bg-clip-text text-transparent">
              Powered by Multi-Agents
            </span>
          </h1>

          <p className="text-base sm:text-lg text-gray-500 dark:text-gray-400 max-w-2xl leading-relaxed font-sans">
            Streamline Indian legal case analysis. Deploy a coordinated network of AI legal agents—from evidence auditors to prosecution, defense, and jury panels—to deliver deep trace insights automatically.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 w-full sm:w-auto">
            <button 
              onClick={scrollToSimulator}
              className="w-full sm:w-auto bg-[#176B87] dark:bg-[#2DD4BF] hover:bg-[#115066] dark:hover:bg-[#22bca9] text-white px-8 py-3.5 rounded-full font-bold text-sm tracking-tight transition-all duration-200 shadow-lg shadow-[#176B87]/20 dark:shadow-[#2DD4BF]/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Simulator</span>
              <Play className="w-4 h-4 fill-white" />
            </button>
            <button 
              onClick={scrollToFeatures}
              className="w-full sm:w-auto premium-glass text-black dark:text-white px-8 py-3.5 rounded-full font-bold text-sm tracking-tight hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>How It Works</span>
              <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Infinite Scrolling Marquees Section */}
      <section className="py-12 bg-black/2 dark:bg-white/2 border-y border-gray-200/50 dark:border-white/5 relative z-10 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 mb-6 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            INTEGRATED PLATFORMS & BACKED BY LEADING FIRMS
          </span>
        </div>

        {/* Marquee 1: Brand Integrations */}
        <div className="relative w-full flex items-center overflow-hidden py-3">
          <div className="marquee-track flex gap-12 text-gray-400 dark:text-gray-500 font-semibold items-center text-sm">
            {[...brandLogos, ...brandLogos].map((logo, index) => (
              <div key={index} className="flex items-center gap-2 select-none">
                <svg className="w-5 h-5 fill-current opacity-60" viewBox="0 0 32 32">
                  <path d={logo.path} />
                </svg>
                <span className="font-sans text-sm tracking-wider font-semibold opacity-70">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Marquee 2: Backers */}
        <div className="relative w-full flex items-center overflow-hidden py-3 mt-2">
          <div className="backers-track flex gap-16 text-gray-400 dark:text-gray-500 font-bold items-center text-xs">
            {[...backerLogos, ...backerLogos].map((backer, index) => (
              <span key={index} className="font-sans tracking-widest uppercase opacity-65 select-none whitespace-nowrap">
                {backer}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Agent Explanation (Info cards) Section */}
      <section ref={featuresRef} className="py-24 px-6 md:px-12 relative z-10 max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 mb-16 text-center items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B87] dark:text-[#2DD4BF] bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 px-3.5 py-1.5 rounded-full">
            Autonomous Collaboration
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-black dark:text-white font-sans">
            How The Agent Network Rules
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed text-sm">
            LEXA splits legal analysis into core responsibilities. AI agents collaborate asynchronously in a sandbox environment to construct the legal graph.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1 */}
          <div className="info-card premium-glass p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 text-[#176B87] dark:text-[#2DD4BF] flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">Factual Auditing</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                Evidence Agent digests case files, parses timeline patterns, indexes key people, and isolates exact dates.
              </p>
            </div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Evidence Agent
            </div>
          </div>
 
          {/* Card 2 */}
          <div className="info-card premium-glass p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 text-[#176B87] dark:text-[#2DD4BF] flex items-center justify-center">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">Statutory Retrieval</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                Legal Research Agent runs vector searches to fetch corresponding Indian Penal Code (IPC) and Bharatiya Nyaya Sanhita (BNS) statutes.
              </p>
            </div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Research Agent
            </div>
          </div>
 
          {/* Card 3 */}
          <div className="info-card premium-glass p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 text-[#176B87] dark:text-[#2DD4BF] flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">Adversarial Debate</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                Prosecution and Defense agents analyze findings in real time, formulating legal strategies and identifying evidentiary conflicts.
              </p>
            </div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Counsel Agents
            </div>
          </div>
 
          {/* Card 4 */}
          <div className="info-card premium-glass p-8 flex flex-col justify-between gap-8">
            <div className="flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#176B87]/5 dark:bg-[#2DD4BF]/5 text-[#176B87] dark:text-[#2DD4BF] flex items-center justify-center">
                <Gavel className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold tracking-tight text-black dark:text-white">Judicial Ruling</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-sans">
                A 12-person jury votes on verdict confidence, and the Judge compiles reasoning to deliver the final arbitration.
              </p>
            </div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">
              Arbitrator Panel
            </div>
          </div>
        </div>
      </section>

      {/* Simulator Workspace Section */}
      <section 
        ref={simulatorRef}
        id="simulator" 
        className="py-24 px-6 md:px-12 relative z-10 max-w-7xl mx-auto border-t border-gray-200/50 dark:border-white/5"
      >
        <div className="flex flex-col gap-3 mb-12 text-left">
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B87] dark:text-[#2DD4BF]">
            Active Sandbox
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-black dark:text-white font-sans">
            Courtroom Simulator Workspace
          </h2>
          <p className="text-gray-500 dark:text-gray-400 leading-relaxed text-sm max-w-xl">
            Input witness accounts or load sample trial cases below to trigger the live agent trace.
          </p>
        </div>

        {/* Integrated Core Workspace Grid */}
        <div className="workspace">
          <aside>
            <CaseUploader onCaseCreated={selectCase} />
            <CaseHistory cases={cases} activeCaseId={caseId} onSelect={selectCase} />
          </aside>
          
          <div className="main-stack">
            <AgentPanel logs={logs} />
            <VerdictCard verdict={verdict} status={caseStatus} error={analysisError} />
          </div>
        </div>
      </section>

      {/* Use Cases Section with Video Overlays */}
      <section ref={useCasesRef} className="py-24 px-6 md:px-12 relative z-10 max-w-7xl mx-auto border-t border-gray-200/50 dark:border-white/5">
        <div className="flex flex-col gap-4 mb-16 text-center items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-[#176B87] dark:text-[#45A987] bg-[#176B87]/5 dark:bg-[#45A987]/5 px-3.5 py-1.5 rounded-full">
            Commercial Scope
          </span>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-black dark:text-white font-sans">
            Simulated Courtroom Commerce
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-xl leading-relaxed text-sm">
            Deploy LEXA's multi-agent intelligence across diverse legal categories and commercial disputes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <UseCaseCard 
            title="Commercial Litigation & Contracts"
            desc="Examine financial defaults, ownership claims, partnership breakups, and verify transaction records against obligations."
            icon={Briefcase}
            videoUrl="https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-gold-coin-41908-large.mp4"
          />
          <UseCaseCard 
            title="Intellectual Property & Licensing"
            desc="Map source code, trademark usage, patents, and copyright infringement traces against registered patents."
            icon={Cpu}
            videoUrl="https://assets.mixkit.co/videos/preview/mixkit-circuit-board-details-42283-large.mp4"
          />
          <UseCaseCard 
            title="Criminal Trial & Procedural Audits"
            desc="Audit police logs, verify witness reliability, detect factual contradictions, and run jury deliberations."
            icon={Scale}
            videoUrl="https://assets.mixkit.co/videos/preview/mixkit-surveillance-camera-rotating-in-the-street-41712-large.mp4"
          />
          <UseCaseCard 
            title="Corporate Compliance Audits"
            desc="Cross-reference transaction history logs against regulatory directives and audit compliance."
            icon={Globe}
            videoUrl="https://assets.mixkit.co/videos/preview/mixkit-business-people-meeting-around-a-table-41682-large.mp4"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black/5 dark:bg-white/2 border-t border-gray-200/50 dark:border-white/5 py-16 px-6 md:px-12 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <LogoIcon />
            <span className="font-extrabold text-lg tracking-tight text-black dark:text-white">LEXA</span>
          </div>
          
          <div className="flex items-center gap-8 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5">
              <span>GitHub</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a href="https://docs.lexa.ai" target="_blank" rel="noopener noreferrer" className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1.5">
              <span>Documentation</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 font-sans">
            Copyright {new Date().getFullYear()} LEXA Inc. All rights reserved. Indian jurisdiction simulator.
          </p>
        </div>
      </footer>
    </div>
  )
}
