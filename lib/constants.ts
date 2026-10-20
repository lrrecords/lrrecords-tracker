export const APP_NAME = 'LRR Coin';
export const APP_SHORT_NAME = 'LRR Coin';

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'To Do',
  in_progress: 'In Progress',
  submitted: 'Submitted for Review',
  signed_off: 'Signed Off',
};

export const SONG_STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  writing: 'Writing',
  recording: 'Recording',
  mixing: 'Mixing',
  mastering: 'Mastering',
  released: 'Released',
};

export const EVIDENCE_TYPE_LABELS: Record<string, string> = {
  text: 'Text note',
  link: 'Link',
  file: 'File',
  screenshot: 'Screenshot',
};

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  content: 'Content creation',
  promotion: 'Sharing or promoting releases',
  playlist: 'Playlist pitching',
  feedback: 'Feedback on music or mixes',
  admin: 'Admin or organisation',
  other: 'Something else',
};

// Application options mirror the LRR Coin Jotform survey.
export const WEEKLY_HOURS_OPTIONS = ['Under 1 hour', '1–3 hours', '3–5 hours', 'More than 5 hours'];
export const RELATIONSHIP_OPTIONS = [
  "Yes, I'm on the roster",
  'Yes, one-off session or project',
  'Not yet — first time',
];

export const LEDGER_REASON_LABELS: Record<string, string> = {
  task: 'Task signed off',
  redemption: 'Redeemed',
  adjustment: 'Adjustment',
  expiry: 'Expired',
};

export const REDEMPTION_STATUS_LABELS: Record<string, string> = {
  requested: 'Waiting for approval',
  approved: 'Approved — booking with Brett',
  declined: 'Declined',
  completed: 'Done',
  cancelled: 'Cancelled',
};

export function formatDate(d: string | null | undefined) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}
