import { promises as fs } from 'fs';
import path from 'path';

export type SandboxFunnel = {
  id: string;
  experience_id: string;
  company_id: string;
  steps: any[];
  counting_mode: 'A' | 'B';
  created_at: string;
  updated_at: string;
};

type FunnelFile = {
  nextId: number;
  byExperienceId: Record<string, SandboxFunnel>;
};

function getFunnelsFilePath(): string {
  return path.resolve(process.cwd(), '.local', 'funnels.json');
}

async function ensureDirExists(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function readFileSafe(filePath: string): Promise<FunnelFile> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as FunnelFile;
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid funnels file');
    if (typeof parsed.nextId !== 'number') parsed.nextId = 1;
    if (!parsed.byExperienceId || typeof parsed.byExperienceId !== 'object') parsed.byExperienceId = {};
    return parsed;
  } catch {
    return { nextId: 1, byExperienceId: {} };
  }
}

async function writeFileAtomic(filePath: string, data: FunnelFile) {
  await ensureDirExists(filePath);
  const tmp = `${filePath}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
  await fs.rename(tmp, filePath);
}

export async function getSandboxFunnel(experienceId: string): Promise<SandboxFunnel | null> {
  const filePath = getFunnelsFilePath();
  const data = await readFileSafe(filePath);
  return data.byExperienceId[experienceId] || null;
}

export async function upsertSandboxFunnel(input: {
  experience_id: string;
  company_id: string;
  steps: any[];
  counting_mode: 'A' | 'B';
}): Promise<SandboxFunnel> {
  const filePath = getFunnelsFilePath();
  const data = await readFileSafe(filePath);
  const now = new Date().toISOString();

  const existing = data.byExperienceId[input.experience_id];
  if (existing) {
    const updated: SandboxFunnel = {
      ...existing,
      company_id: input.company_id,
      steps: input.steps,
      counting_mode: input.counting_mode,
      updated_at: now,
    };
    data.byExperienceId[input.experience_id] = updated;
    await writeFileAtomic(filePath, data);
    return updated;
  }

  const created: SandboxFunnel = {
    id: `local_${data.nextId++}`,
    experience_id: input.experience_id,
    company_id: input.company_id,
    steps: input.steps,
    counting_mode: input.counting_mode,
    created_at: now,
    updated_at: now,
  };
  data.byExperienceId[input.experience_id] = created;
  await writeFileAtomic(filePath, data);
  return created;
}

export async function deleteSandboxFunnel(experienceId: string): Promise<boolean> {
  const filePath = getFunnelsFilePath();
  const data = await readFileSafe(filePath);
  const existed = Boolean(data.byExperienceId[experienceId]);
  if (existed) {
    delete data.byExperienceId[experienceId];
    await writeFileAtomic(filePath, data);
  }
  return existed;
}


