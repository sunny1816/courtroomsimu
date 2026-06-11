const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export type GPUInfo = {
  tier: 'h200' | 'rtx4060' | 'cpu'
  device: string
  available: boolean
  cuda_available?: boolean
  torch_device?: string
  vram?: string
  error?: string
}

export type DatasetFile = {
  name: string
  size_kb: number
}

export type TrainingStatus = {
  status: 'idle' | 'starting' | 'loading_model' | 'training' | 'completed' | 'failed'
  base_model?: string
  started_at?: string
  completed_at?: string
  epoch?: number
  num_epochs?: number
  step?: number
  total_steps?: number
  loss?: number | null
  log?: string[]
  error?: string
  output_dir?: string
  adapter_ready?: boolean
}

export type TrainRequest = {
  base_model?: string
  num_epochs?: number
  batch_size?: number
  learning_rate?: number
  lora_r?: number
  lora_alpha?: number
  max_seq_length?: number
}

export async function getGPUInfo(): Promise<GPUInfo> {
  const res = await fetch(`${API_URL}/api/v1/training/gpu`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function listDatasets(): Promise<DatasetFile[]> {
  const res = await fetch(`${API_URL}/api/v1/training/datasets`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function uploadDataset(file: File): Promise<{ filename: string; records: number; status: string }> {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch(`${API_URL}/api/v1/training/upload`, { method: 'POST', body })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function startTraining(req: TrainRequest = {}): Promise<{
  status: string
  train_samples: number
  val_samples: number
  base_model: string
}> {
  const res = await fetch(`${API_URL}/api/v1/training/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function getTrainingStatus(): Promise<TrainingStatus> {
  const res = await fetch(`${API_URL}/api/v1/training/status`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function resetTraining(): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/training/reset`, { method: 'POST' })
  if (!res.ok) throw new Error(await res.text())
}
