import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Database,
  FileJson,
  Loader2,
  Moon,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Sun,
  Upload,
  Zap,
} from 'lucide-react'
import {
  getGPUInfo,
  getTrainingStatus,
  listDatasets,
  resetTraining,
  startTraining,
  uploadDataset,
  type DatasetFile,
  type GPUInfo,
  type TrainingStatus,
} from '../lib/training_api'

// ─── Logo (reused from Home) ───────────────────────────────────────────────

function LogoIcon() {
  return (
    <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-tr from-[#176B87] to-[#2DD4BF] text-white shadow-md shadow-[#176B87]/20">
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    </div>
  )
}

// ─── GPU Badge ─────────────────────────────────────────────────────────────

const GPU_META: Record<string, { label: string; color: string; bg: string }> = {
  h200:    { label: 'NVIDIA H200',   color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  rtx4060: { label: 'NVIDIA RTX 4060', color: '#00ADB5', bg: 'rgba(0,173,181,0.12)' },
  cpu:     { label: 'CPU only',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
}

function GPUBadge({ info }: { info: GPUInfo | null }) {
  if (!info) return <span className="text-xs text-gray-400 animate-pulse">Detecting GPU…</span>
  const meta = GPU_META[info.tier] ?? GPU_META.cpu
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.color}33` }}
    >
      <Cpu className="w-3 h-3" />
      {info.device}
    </span>
  )
}

// ─── Progress bar ──────────────────────────────────────────────────────────

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--primary-color)' }}>
        <span>Step {value} / {max}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--primary-color), var(--accent-color))',
          }}
        />
      </div>
    </div>
  )
}

// ─── Status chip ───────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  idle:          { label: 'Idle',          color: '#6b7280', icon: <Cpu className="w-3.5 h-3.5" /> },
  starting:      { label: 'Starting',      color: '#f59e0b', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  loading_model: { label: 'Loading Model', color: '#f59e0b', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  training:      { label: 'Training',      color: '#00ADB5', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  completed:     { label: 'Completed',     color: '#10b981', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  failed:        { label: 'Failed',        color: '#ef4444', icon: <AlertCircle className="w-3.5 h-3.5" /> },
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META.idle
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={{ color: meta.color, background: `${meta.color}18`, border: `1px solid ${meta.color}33` }}
    >
      {meta.icon}
      {meta.label}
    </span>
  )
}

// ─── Log viewer ────────────────────────────────────────────────────────────

function LogViewer({ lines }: { lines: string[] }) {
  const [expanded, setExpanded] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded) endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines, expanded])

  return (
    <div className="premium-glass rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        style={{ color: 'var(--primary-color)' }}
      >
        <span className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          Training Log
          <span className="text-xs font-normal opacity-60">({lines.length} lines)</span>
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <div
            className="rounded-lg p-3 font-mono text-xs leading-relaxed overflow-y-auto max-h-56 space-y-0.5"
            style={{ background: 'rgba(0,0,0,0.25)', color: '#a3e4d7' }}
          >
            {lines.length === 0 ? (
              <p className="text-gray-500">No log output yet.</p>
            ) : (
              lines.map((line, i) => <div key={i}>{line}</div>)
            )}
            <div ref={endRef} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Advanced settings ─────────────────────────────────────────────────────

type TrainConfig = {
  base_model: string
  num_epochs: number
  batch_size: number
  learning_rate: number
  lora_r: number
  lora_alpha: number
  max_seq_length: number
}

const DEFAULT_CONFIG: TrainConfig = {
  base_model: 'Qwen/Qwen2.5-3B-Instruct',
  num_epochs: 3,
  batch_size: 4,
  learning_rate: 0.0002,
  lora_r: 16,
  lora_alpha: 32,
  max_seq_length: 1024,
}

function AdvancedSettings({ config, onChange }: { config: TrainConfig; onChange: (c: TrainConfig) => void }) {
  const [open, setOpen] = useState(false)

  const field = (label: string, key: keyof TrainConfig, type: 'text' | 'number' = 'number') => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium opacity-70">{label}</label>
      <input
        type={type}
        value={config[key] as string | number}
        onChange={e => onChange({ ...config, [key]: type === 'number' ? Number(e.target.value) : e.target.value })}
        className="w-full px-3 py-2 rounded-lg text-sm font-mono border transition-colors focus:outline-none"
        style={{
          background: 'rgba(0,0,0,0.2)',
          borderColor: 'var(--card-border)',
          color: 'inherit',
        }}
      />
    </div>
  )

  return (
    <div className="premium-glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        style={{ color: 'var(--primary-color)' }}
      >
        <span className="flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Training Configuration
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3">
          <div className="col-span-2">{field('Base Model', 'base_model', 'text')}</div>
          {field('Epochs', 'num_epochs')}
          {field('Batch Size', 'batch_size')}
          {field('Learning Rate', 'learning_rate')}
          {field('Max Seq Length', 'max_seq_length')}
          {field('LoRA r', 'lora_r')}
          {field('LoRA alpha', 'lora_alpha')}
        </div>
      )}
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────

export function Training() {
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('lexa-theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    localStorage.setItem('lexa-theme', dark ? 'dark' : 'light')
  }, [dark])

  const [gpu, setGpu] = useState<GPUInfo | null>(null)
  const [datasets, setDatasets] = useState<DatasetFile[]>([])
  const [status, setStatus] = useState<TrainingStatus>({ status: 'idle' })
  const [config, setConfig] = useState<TrainConfig>(DEFAULT_CONFIG)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const isRunning = ['starting', 'loading_model', 'training'].includes(status.status)

  // Initial fetch
  useEffect(() => {
    getGPUInfo().then(setGpu).catch(() => {})
    listDatasets().then(setDatasets).catch(() => {})
    getTrainingStatus().then(setStatus).catch(() => {})
  }, [])

  // Poll while training
  useEffect(() => {
    if (isRunning) {
      pollRef.current = setInterval(async () => {
        try {
          const s = await getTrainingStatus()
          setStatus(s)
          if (!['starting', 'loading_model', 'training'].includes(s.status)) {
            clearInterval(pollRef.current!)
          }
        } catch { /* ignore */ }
      }, 2000)
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [isRunning])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadSuccess('')
    try {
      const res = await uploadDataset(file)
      setUploadSuccess(`Uploaded "${res.filename}" — ${res.records} records`)
      const updated = await listDatasets()
      setDatasets(updated)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleStart = async () => {
    setLaunching(true)
    setLaunchError('')
    try {
      await startTraining(config)
      const s = await getTrainingStatus()
      setStatus(s)
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : 'Failed to start training')
    } finally {
      setLaunching(false)
    }
  }

  const handleReset = async () => {
    await resetTraining()
    setStatus({ status: 'idle' })
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--page-bg)' }}>
      {/* Ambient halos */}
      <div
        className="fixed top-0 left-0 w-[700px] h-[500px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 10% 10%, var(--halo-glow-color), transparent 60%)' }}
      />
      <div
        className="fixed bottom-0 right-0 w-[700px] h-[500px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle at 90% 90%, var(--halo-glow-color), transparent 60%)' }}
      />

      {/* Navbar */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-3.5 border-b"
        style={{
          background: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <LogoIcon />
          <span className="font-bold text-base tracking-tight" style={{ fontFamily: 'Outfit, sans-serif' }}>
            LEXA
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold ml-1"
            style={{ background: 'var(--section-tint)', color: 'var(--primary-color)', border: '1px solid var(--card-border)' }}
          >
            Model Training
          </span>
        </a>

        <div className="flex items-center gap-3">
          <GPUBadge info={gpu} />
          <a
            href="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'var(--primary-color)', border: '1px solid var(--card-border)' }}
          >
            <Scale className="w-4 h-4" />
            Courtroom
          </a>
          <button
            onClick={() => setDark(d => !d)}
            className="p-2 rounded-lg transition-all"
            style={{ border: '1px solid var(--card-border)', color: 'var(--primary-color)' }}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-10 grid gap-6">

        {/* Page title */}
        <div>
          <h1
            className="text-3xl font-bold tracking-tight mb-1"
            style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--primary-color)' }}
          >
            Legal Model Fine-Tuning
          </h1>
          <p className="text-sm opacity-60">
            Upload a legal dataset, configure QLoRA training parameters, and fine-tune Qwen 2.5 or Llama 3.1.
          </p>
        </div>

        {/* Top row: training status + GPU */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Status card */}
          <div className="md:col-span-2 premium-glass rounded-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Training Status</h2>
              <div className="flex items-center gap-2">
                <StatusChip status={status.status} />
                {(status.status === 'completed' || status.status === 'failed') && (
                  <button
                    onClick={handleReset}
                    className="p-1.5 rounded-lg transition-all hover:opacity-80"
                    style={{ border: '1px solid var(--card-border)', color: 'var(--primary-color)' }}
                    title="Reset"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {status.base_model && (
              <p className="text-xs opacity-60">
                Model: <span className="font-mono">{status.base_model}</span>
              </p>
            )}

            {isRunning && status.total_steps != null && status.total_steps > 0 && (
              <ProgressBar value={status.step ?? 0} max={status.total_steps} />
            )}

            {isRunning && status.num_epochs != null && (
              <div className="flex items-center gap-3 text-xs opacity-70">
                <span>Epoch {Math.ceil(status.epoch ?? 0)} / {status.num_epochs}</span>
                {status.loss != null && <span>Loss: {status.loss.toFixed(4)}</span>}
              </div>
            )}

            {status.status === 'completed' && status.adapter_ready && (
              <div
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <CheckCircle2 className="w-4 h-4" />
                Adapter saved to <span className="font-mono ml-1">{status.output_dir ?? 'models/lexa-legal'}</span>
              </div>
            )}

            {status.status === 'failed' && status.error && (
              <div
                className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <AlertCircle className="w-4 h-4" />
                {status.error}
              </div>
            )}
          </div>

          {/* GPU info card */}
          <div className="premium-glass rounded-xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4" style={{ color: 'var(--primary-color)' }} />
              Compute
            </h2>
            {gpu ? (
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Compute:</span>
                  <p className="font-semibold text-sm text-black dark:text-white">{gpu.device}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Status:</span>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: gpu.available ? '#10b981' : '#f59e0b' }}>
                    {gpu.available ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> CUDA Available</>
                    ) : (
                      <><AlertCircle className="w-3.5 h-3.5" /> CPU-only mode</>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Device:</span>
                  <p className="text-sm font-mono text-black dark:text-white">{gpu.torch_device ?? (gpu.available ? 'cuda' : 'cpu')}</p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">VRAM:</span>
                  <p className="text-sm text-black dark:text-white">
                    {gpu.available ? (gpu.vram ? `Detected Automatically (${gpu.vram})` : 'Detected Automatically') : 'N/A'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs opacity-50">
                <Loader2 className="w-4 h-4 animate-spin" /> Detecting…
              </div>
            )}
          </div>
        </div>

        {/* Dataset upload */}
        <div className="premium-glass rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <FileJson className="w-4 h-4" style={{ color: 'var(--primary-color)' }} />
              Training Datasets
              <span className="text-xs font-normal opacity-50 ml-1">.json / .jsonl</span>
            </h2>
            <button
              onClick={() => listDatasets().then(setDatasets).catch(() => {})}
              className="p-1.5 rounded-lg transition-all hover:opacity-80"
              style={{ border: '1px solid var(--card-border)', color: 'var(--primary-color)' }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Supported schemas hint */}
          <div
            className="text-xs px-3 py-2 rounded-lg leading-relaxed opacity-70"
            style={{ background: 'var(--section-tint)', border: '1px solid var(--card-border)' }}
          >
            Supported record schemas: &nbsp;
            <code className="font-mono">&#123;instruction, output&#125;</code> &nbsp;·&nbsp;
            <code className="font-mono">&#123;question, answer&#125;</code> &nbsp;·&nbsp;
            <code className="font-mono">&#123;context, verdict&#125;</code> &nbsp;·&nbsp;
            <code className="font-mono">&#123;statement_a, statement_b&#125;</code>
          </div>

          {/* Uploaded files */}
          {datasets.length > 0 && (
            <div className="grid gap-1.5">
              {datasets.map(f => (
                <div
                  key={f.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs"
                  style={{ background: 'rgba(0,0,0,0.1)', border: '1px solid var(--card-border)' }}
                >
                  <span className="font-mono">{f.name}</span>
                  <span className="opacity-50">{f.size_kb} KB</span>
                </div>
              ))}
            </div>
          )}

          {/* Upload button */}
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.jsonl"
              onChange={handleFileUpload}
              className="hidden"
              id="dataset-upload"
            />
            <label
              htmlFor="dataset-upload"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all hover:opacity-90"
              style={{
                background: 'var(--section-tint)',
                border: '1px solid var(--card-border)',
                color: 'var(--primary-color)',
              }}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Uploading…' : 'Upload Dataset'}
            </label>
            {uploadSuccess && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />{uploadSuccess}
              </span>
            )}
            {uploadError && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />{uploadError}
              </span>
            )}
          </div>
        </div>

        {/* Config */}
        <AdvancedSettings config={config} onChange={setConfig} />

        {/* Launch button */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStart}
            disabled={isRunning || launching || datasets.length === 0}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isRunning
                ? 'rgba(0,0,0,0.2)'
                : 'linear-gradient(135deg, var(--primary-color), var(--accent-color))',
              color: '#fff',
              boxShadow: isRunning ? 'none' : '0 4px 20px rgba(23,107,135,0.35)',
            }}
          >
            {launching || isRunning
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isRunning ? 'Training in progress…' : 'Launching…'}</>
              : <><Play className="w-4 h-4" />Start Fine-Tuning</>}
          </button>
          {launchError && (
            <p className="text-xs text-red-400 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />{launchError}
            </p>
          )}
          {datasets.length === 0 && (
            <p className="text-xs opacity-50 text-center">Upload at least one dataset file to enable training.</p>
          )}
        </div>

        {/* Log viewer */}
        {(status.log?.length ?? 0) > 0 && <LogViewer lines={status.log ?? []} />}

        {/* Footer note */}
        <p className="text-xs opacity-40 text-center pb-4">
          Training runs in a background thread. Progress polls every 2 s.
          The fine-tuned adapter is saved to <code className="font-mono">models/lexa-legal/</code>.
        </p>
      </main>
    </div>
  )
}
