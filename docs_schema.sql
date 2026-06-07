create table cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_path text,
  raw_text text,
  status text default 'pending',
  created_at timestamptz default now()
);

create table verdicts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id),
  verdict text,
  confidence float,
  evidence_summary text,
  prosecution_args text,
  defense_args text,
  contradictions jsonb,
  retrieved_laws jsonb,
  judge_reasoning text,
  jury_vote jsonb,
  appeal_decision text,
  agent_trace jsonb,
  created_at timestamptz default now()
);

create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id),
  agent_name text,
  output jsonb,
  created_at timestamptz default now()
);
