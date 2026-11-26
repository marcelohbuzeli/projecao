/**
 * Envios dos pastores — arquivos enviados por um link público e guardados no Supabase (plano gratuito).
 * Tudo via REST (sem SDK). A segurança é feita por dois códigos:
 *  - código de envio (vai no link dos pastores): só permite ENVIAR;
 *  - código do operador (fica só neste painel): permite listar, marcar e apagar.
 */

export interface EnviosConfig {
  url: string
  key: string
  up: string // código de envio
  admin: string // código do operador
}

export type EnvioKind = 'slide' | 'aviso' | 'video' | 'imagem' | 'outro'

export const ENVIO_KINDS: { id: EnvioKind; label: string }[] = [
  { id: 'slide', label: 'Slide da pregação' },
  { id: 'aviso', label: 'Aviso' },
  { id: 'video', label: 'Vídeo' },
  { id: 'imagem', label: 'Imagem' },
  { id: 'outro', label: 'Outro' },
]

export interface Envio {
  id: string
  created_at: string
  service_date: string // YYYY-MM-DD
  kind: EnvioKind
  sender: string | null
  title: string | null
  note: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  mime: string | null
  status: 'novo' | 'importado'
  expires_on: string | null // YYYY-MM-DD: apagado depois deste dia · null = permanente
}

export const SCHEMA_VERSION = 2

export const MAX_FILE = 50 * 1024 * 1024

export const randomCode = (n = 12) => {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789'
  const r = crypto.getRandomValues(new Uint8Array(n))
  return Array.from(r, (x) => a[x % a.length]).join('')
}

export const cleanUrl = (u: string) => u.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '')

function headers(cfg: EnviosConfig, extra: Record<string, string> = {}) {
  const h: Record<string, string> = { apikey: cfg.key.trim(), ...extra }
  // chave antiga (JWT "anon") vai também no Authorization; a nova "publishable" não precisa
  if (cfg.key.trim().startsWith('eyJ')) h.Authorization = 'Bearer ' + cfg.key.trim()
  return h
}

async function rpc<T>(cfg: EnviosConfig, fn: string, body: object): Promise<T> {
  const r = await fetch(`${cleanUrl(cfg.url)}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: headers(cfg, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await errText(r))
  const t = await r.text()
  return (t ? JSON.parse(t) : null) as T
}

async function errText(r: Response) {
  try {
    const j = await r.json()
    return j.message || j.error || j.msg || `Erro ${r.status}`
  } catch {
    return `Erro ${r.status}`
  }
}

// ---------- link dos pastores ----------
const b64e = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64d = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function uploadLink(base: string, cfg: EnviosConfig) {
  return `${base}#/enviar?c=${b64e(JSON.stringify({ u: cleanUrl(cfg.url), k: cfg.key.trim(), c: cfg.up }))}`
}

export function parseUploadParam(p: string | null): Omit<EnviosConfig, 'admin'> | null {
  if (!p) return null
  try {
    const j = JSON.parse(b64d(p))
    if (j.u && j.k && j.c) return { url: j.u, key: j.k, up: j.c }
  } catch {
    /* link inválido */
  }
  return null
}

// ---------- lado do pastor ----------
export const checkUploadCode = (cfg: Omit<EnviosConfig, 'admin'>) => rpc<boolean>({ ...cfg, admin: '' }, 'envios_check', { c: cfg.up })

const safeName = (n: string) =>
  n
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(-80) || 'arquivo'

export function uploadFile(cfg: Omit<EnviosConfig, 'admin'>, file: File, date: string, kind: EnvioKind, onProgress: (p: number) => void): Promise<string> {
  const path = `${cfg.up}/${date}/${kind}/${randomCode(6)}-${safeName(file.name)}`
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest()
    x.open('POST', `${cleanUrl(cfg.url)}/storage/v1/object/envios/${path}`)
    const h = headers({ ...cfg, admin: '' }, { 'x-upsert': 'false', 'Content-Type': file.type || 'application/octet-stream' })
    for (const k in h) x.setRequestHeader(k, h[k])
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) resolve(path)
      else {
        let m = `Erro ${x.status}`
        try {
          const j = JSON.parse(x.responseText)
          m = j.message || j.error || m
        } catch {
          /* */
        }
        reject(new Error(m))
      }
    }
    x.onerror = () => reject(new Error('Sem conexão'))
    x.send(file)
  })
}

export async function createEnvio(cfg: Omit<EnviosConfig, 'admin'>, e: Omit<Envio, 'id' | 'created_at' | 'status' | 'expires_on'> & { expires_on?: string | null }) {
  const r = await fetch(`${cleanUrl(cfg.url)}/rest/v1/envios`, {
    method: 'POST',
    headers: headers({ ...cfg, admin: '' }, { 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify({ ...e, code: cfg.up }),
  })
  if (!r.ok) throw new Error(await errText(r))
}

// ---------- lado do operador ----------
export const listEnvios = (cfg: EnviosConfig) => rpc<Envio[]>(cfg, 'envios_list', { admin: cfg.admin })
export const setEnvioExpiry = (cfg: EnviosConfig, id: string, d: string | null) => rpc<null>(cfg, 'envios_set_expiry', { admin: cfg.admin, envio: id, d })
export async function schemaVersion(cfg: Omit<EnviosConfig, 'admin'>) {
  try {
    return (await rpc<number>({ ...cfg, admin: '' }, 'envios_version', {})) ?? 1
  } catch {
    return 1
  }
}
export const isExpired = (e: Envio, today = isoDate(new Date())) => !!e.expires_on && e.expires_on < today
export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}
export function fmtShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: y !== new Date().getFullYear() ? '2-digit' : undefined })
}
export const setEnvioStatus = (cfg: EnviosConfig, id: string, status: Envio['status']) => rpc<null>(cfg, 'envios_set_status', { admin: cfg.admin, envio: id, new_status: status })

export async function deleteEnvio(cfg: EnviosConfig, e: Envio) {
  if (e.file_path) {
    await fetch(`${cleanUrl(cfg.url)}/storage/v1/object/envios/${e.file_path}`, { method: 'DELETE', headers: headers(cfg) }).catch(() => {})
  }
  await rpc<null>(cfg, 'envios_delete', { admin: cfg.admin, envio: e.id })
}

export async function downloadEnvio(cfg: EnviosConfig, e: Envio): Promise<File> {
  const r = await fetch(`${cleanUrl(cfg.url)}/storage/v1/object/authenticated/envios/${e.file_path}`, { headers: headers(cfg) })
  if (!r.ok) throw new Error(await errText(r))
  const b = await r.blob()
  return new File([b], e.file_name || 'arquivo', { type: e.mime || b.type })
}

// ---------- script de criação (colar no SQL Editor do Supabase) ----------
export function setupSql(cfg: Pick<EnviosConfig, 'up' | 'admin'>) {
  return `-- Projeção · envios dos pastores (pode rodar de novo quando quiser trocar os códigos)
create table if not exists public.envios_config (id int primary key default 1, upload_code text not null, admin_code text not null);
insert into public.envios_config (id, upload_code, admin_code) values (1, '${cfg.up}', '${cfg.admin}')
  on conflict (id) do update set upload_code = excluded.upload_code, admin_code = excluded.admin_code;
alter table public.envios_config enable row level security;

create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  code text not null,
  service_date date not null,
  kind text not null,
  sender text, title text, note text,
  file_path text, file_name text, file_size bigint, mime text,
  status text not null default 'novo'
);
alter table public.envios enable row level security;
alter table public.envios add column if not exists expires_on date;

create or replace function public.envios_version() returns int language sql immutable as $$ select 2 $$;

create or replace function public.envios_check(c text) returns boolean
  language sql stable security definer set search_path = public
  as $$ select exists(select 1 from envios_config where id = 1 and upload_code = c) $$;

drop policy if exists envios_insert on public.envios;
create policy envios_insert on public.envios for insert with check (public.envios_check(code));

create or replace function public.envios_list(admin text) returns setof public.envios
  language sql stable security definer set search_path = public
  as $$ select * from envios where exists(select 1 from envios_config where id = 1 and admin_code = admin) order by service_date, created_at $$;

create or replace function public.envios_set_status(admin text, envio uuid, new_status text) returns void
  language sql security definer set search_path = public
  as $$ update envios set status = new_status where id = envio and exists(select 1 from envios_config where id = 1 and admin_code = admin) $$;

create or replace function public.envios_set_expiry(admin text, envio uuid, d date) returns void
  language sql security definer set search_path = public
  as $$ update envios set expires_on = d where id = envio and exists(select 1 from envios_config where id = 1 and admin_code = admin) $$;

create or replace function public.envios_delete(admin text, envio uuid) returns void
  language sql security definer set search_path = public
  as $$ delete from envios where id = envio and exists(select 1 from envios_config where id = 1 and admin_code = admin) $$;

insert into storage.buckets (id, name, public, file_size_limit) values ('envios', 'envios', false, 52428800)
  on conflict (id) do nothing;

drop policy if exists envios_files_insert on storage.objects;
create policy envios_files_insert on storage.objects for insert
  with check (bucket_id = 'envios' and public.envios_check((storage.foldername(name))[1]));
drop policy if exists envios_files_select on storage.objects;
create policy envios_files_select on storage.objects for select
  using (bucket_id = 'envios' and public.envios_check((storage.foldername(name))[1]));
drop policy if exists envios_files_delete on storage.objects;
create policy envios_files_delete on storage.objects for delete
  using (bucket_id = 'envios' and public.envios_check((storage.foldername(name))[1]));
`
}

// ---------- datas ----------
export const isoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function nextWeekday(dow: number) {
  const d = new Date()
  d.setDate(d.getDate() + ((dow - d.getDay() + 7) % 7))
  return isoDate(d)
}
export function fmtServiceDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const today = isoDate(new Date())
  const label = dt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })
  return s === today ? 'Hoje · ' + label : label.charAt(0).toUpperCase() + label.slice(1)
}
