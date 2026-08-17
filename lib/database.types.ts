// Hand-written types mirroring supabase/schema.sql.
// If you change the schema, update this file to match.

export type Role = 'admin' | 'student';
export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'signed_off';
export type EvidenceType = 'text' | 'link' | 'file' | 'screenshot';
export type SongStatus = 'idea' | 'writing' | 'recording' | 'mixing' | 'mastering' | 'released';
export type UnlockStatus = 'available' | 'used';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  week_of: string | null;
  due_date: string | null;
  status: TaskStatus;
  assigned_to: string | null;
  created_by: string | null;
  sort_order: number;
  signed_off_at: string | null;
  signed_off_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskEvidence {
  id: string;
  task_id: string;
  type: EvidenceType;
  content: string;
  file_path: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TaskNote {
  id: string;
  task_id: string;
  author_id: string | null;
  note: string;
  created_at: string;
}

export interface Settings {
  id: number;
  tasks_required_for_studio: number;
  studio_hours_per_unlock: number;
  updated_at: string;
}

export interface StudioUnlock {
  id: string;
  earned_at: string;
  tasks_completed_count: number;
  hours: number;
  status: UnlockStatus;
  used_at: string | null;
  notes: string;
}

export interface Song {
  id: string;
  title: string;
  status: SongStatus;
  notes: string;
  created_by: string | null;
  created_at: string;
}

export interface StudioTimeEntry {
  id: string;
  song_id: string | null;
  task_description: string;
  hours: number;
  entry_date: string;
  logged_by: string | null;
  notes: string;
  created_at: string;
}

// NOTE on a `Database` generic type: an earlier version of this file tried
// to hand-write a full `Database` type (Tables/Views/Functions/Relationships)
// to pass into `createClient<Database>()`, matching the shape Supabase's own
// `supabase gen types` CLI produces. It kept resolving `.insert()`/`.update()`
// payloads to `never` on this project's installed @supabase/postgrest-js
// version even once the shape looked structurally correct — the exact
// conditional-type resolution that decides `Schema = never` vs. a real
// schema is internal to postgrest-js and shifts between versions, so a
// hand-written type is fragile to chase without running the real compiler
// against the real installed version.
//
// Simpler and more robust for a hand-maintained project: the Supabase
// clients (lib/supabase/client.ts, lib/supabase/server.ts) are NOT
// parameterized with a Database generic at all. Instead, every read call
// site casts explicitly with `.single<Profile>()` / `.returns<Task[]>()`
// etc., and every insert/update builds a locally-typed payload first
// (`const update: Partial<Settings> = {...}`) before calling `.update()`.
// That gives the same practical type safety without depending on
// postgrest-js's internal generic machinery.
//
// If you later want the real generated types (recommended once this is a
// bigger project), run `npx supabase gen types typescript --project-id
// <ref> > lib/database.types.ts` and update the two client files to pass
// `<Database>` again — the CLI output already has the exact shape that
// version of postgrest-js expects.
