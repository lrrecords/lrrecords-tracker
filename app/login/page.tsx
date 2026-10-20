import { CircleLogo } from '@/components/CircleLogo';
import { APP_NAME, RELATIONSHIP_OPTIONS, TASK_CATEGORY_LABELS, WEEKLY_HOURS_OPTIONS } from '@/lib/constants';
import { signIn, signUp } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; mode?: string };
}) {
  const mode = searchParams.mode === 'signup' ? 'signup' : 'signin';

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <CircleLogo size={72} />
          <h1 className="mt-4 text-lg font-bold text-white">{APP_NAME}</h1>
          <p className="mt-1 text-sm text-navy-200">
            Do tasks, earn studio time. Earn coin for LRRecords tasks and spend it on recording, mixing and mastering.
          </p>
        </div>

        <div className="card">
          {searchParams.error && (
            <div className="mb-4 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-700">
              {searchParams.error}
            </div>
          )}

          {mode === 'signin' ? (
            <>
              <h2 className="mb-4 text-base font-semibold text-navy-900">Sign in</h2>
              <form action={signIn} className="space-y-3">
                <div>
                  <label className="label" htmlFor="email">Email</label>
                  <input className="input" id="email" name="email" type="email" required autoFocus />
                </div>
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <input className="input" id="password" name="password" type="password" required />
                </div>
                <button type="submit" className="btn-primary w-full">Sign in</button>
              </form>
              <p className="mt-4 text-center text-xs text-navy-500">
                New here?{' '}
                <a href="/login?mode=signup" className="font-semibold text-orange-600 hover:underline">
                  Apply to join
                </a>
              </p>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-base font-semibold text-navy-900">Apply to join</h2>
              <p className="mb-4 text-xs text-navy-500">
                Tell us a bit about you. Brett reviews every application, and you can start picking up
                tasks once you&rsquo;re approved.
              </p>
              <form action={signUp} className="space-y-3">
                <div>
                  <label className="label" htmlFor="full_name">Name</label>
                  <input className="input" id="full_name" name="full_name" type="text" required autoFocus />
                </div>
                <div>
                  <label className="label" htmlFor="email">Email</label>
                  <input className="input" id="email" name="email" type="email" required />
                </div>
                <div>
                  <label className="label" htmlFor="password">Password</label>
                  <input className="input" id="password" name="password" type="password" minLength={8} required />
                </div>
                <fieldset>
                  <legend className="label">Tasks you&rsquo;d want to do</legend>
                  <div className="space-y-1">
                    {Object.entries(TASK_CATEGORY_LABELS).map(([value, label]) => (
                      <label key={value} className="flex items-center gap-2 text-sm text-navy-700">
                        <input type="checkbox" name="task_interests" value={value} className="accent-orange-500" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="label" htmlFor="weekly_hours">Time you could give each week</label>
                  <select className="input" id="weekly_hours" name="weekly_hours" required defaultValue="">
                    <option value="" disabled>Choose one</option>
                    {WEEKLY_HOURS_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="relationship">Worked with LRRecords before?</label>
                  <select className="input" id="relationship" name="relationship" required defaultValue="">
                    <option value="" disabled>Choose one</option>
                    {RELATIONSHIP_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="application_note">Anything else? (optional)</label>
                  <textarea className="input" id="application_note" name="application_note" rows={3}
                    placeholder="Links to your music or socials, what you'd like to spend coin on" />
                </div>
                <button type="submit" className="btn-primary w-full">Send application</button>
              </form>
              <p className="mt-4 text-center text-xs text-navy-500">
                Already have an account?{' '}
                <a href="/login" className="font-semibold text-orange-600 hover:underline">
                  Sign in
                </a>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
