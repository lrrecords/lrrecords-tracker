import Link from 'next/link';
import { CircleLogo } from '@/components/CircleLogo';
import { APP_SHORT_NAME } from '@/lib/constants';
import { signOutAction } from '@/app/login/actions';
import type { Profile } from '@/lib/database.types';

export function NavBar({ profile }: { profile: Profile }) {
  return (
    <header className="border-b border-navy-100 bg-navy-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/tasks" className="flex items-center gap-2">
          <CircleLogo size={36} />
          <span className="hidden text-sm font-bold text-white sm:inline">{APP_SHORT_NAME}</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 text-sm font-medium">
          <Link href="/tasks" className="rounded-md px-3 py-1.5 text-navy-100 hover:bg-navy-800 hover:text-white">
            Tasks
          </Link>
          <Link href="/studio" className="rounded-md px-3 py-1.5 text-navy-100 hover:bg-navy-800 hover:text-white">
            Studio
          </Link>
          {profile.role === 'admin' && (
            <Link
              href="/admin/settings"
              className="rounded-md px-3 py-1.5 text-navy-100 hover:bg-navy-800 hover:text-white"
            >
              Settings
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <span className="badge bg-orange-500/15 text-orange-300">
            {profile.role === 'admin' ? 'Admin' : 'Student'}
          </span>
          <span className="hidden text-sm text-navy-200 sm:inline">{profile.full_name || profile.email}</span>
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost text-navy-200 hover:text-white">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
