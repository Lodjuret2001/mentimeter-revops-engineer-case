import type { ReactNode } from 'react';
import { initials } from '@/lib/format';
import { slackText } from '@/lib/slack-text';
import type { SlackUser } from '@/lib/systems/types';
import { cn } from '@/lib/utils';

export const SLACK_AUBERGINE = '#3f0e40';
export const SLACK_BLUE = '#1264a3';

/** Slack-ish avatar backgrounds. The user ID picks one, so a person always gets the same. */
const AVATAR_COLOURS = [
  'bg-[#e01e5a]',
  'bg-[#36c5f0]',
  'bg-[#2eb67d]',
  'bg-[#ecb22e] text-[#1d1c1d]',
  'bg-[#4a154b]',
  'bg-[#1264a3]',
  'bg-[#e8912d]',
  'bg-[#611f69]',
  'bg-[#007a5a]',
  'bg-[#d35400]',
];

function hash(value: string) {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Slack's 36px rounded-square avatar with initials. */
export function SlackAvatar({
  id,
  name,
  className,
}: {
  id: string;
  name: string;
  className?: string;
}) {
  const colour = AVATAR_COLOURS[hash(id) % AVATAR_COLOURS.length];
  return (
    <div
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 select-none items-center justify-center rounded-lg font-bold text-[13px] text-white',
        colour,
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

/** The small "APP" tag Slack puts after a bot's name. */
export function AppTag() {
  return (
    <span className="inline-flex h-[14px] items-center rounded-[3px] bg-muted px-1 font-bold text-[10px] text-muted-foreground uppercase leading-none">
      App
    </span>
  );
}

/** A mention as Slack renders it: a blue pill. */
export function Mention({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] bg-[#1d9bd1]/15 px-0.5 text-[#1264a3] dark:bg-[#1d9bd1]/20 dark:text-[#7ccbff]">
      {children}
    </span>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Message text with `<@ID>` mentions turned into @Name pills. Uses `slackText` for the
 * name lookup, then wraps the names it produced.
 */
export function SlackMessageText({ text, users }: { text: string; users: SlackUser[] }) {
  const resolved = slackText(text, users);
  const names = users
    .map((u) => u.real_name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (names.length === 0) return <>{resolved}</>;
  const pattern = new RegExp(`(@(?:${names.join('|')}))`, 'g');
  const parts = resolved.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: plain text split, order is stable
          <Mention key={i}>{part}</Mention>
        ) : (
          part
        ),
      )}
    </>
  );
}

const STOCKHOLM = 'Europe/Stockholm';

/** "12:40" in Stockholm time, how Slack shows a message in the same week. */
export function slackTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: STOCKHOLM,
  });
}

/** The calendar day a message belongs to, for grouping under one date divider. */
export function slackDay(value: string) {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: STOCKHOLM });
}

/** "Wednesday, 5 November", the label on Slack's date divider. */
export function slackDayLabel(value: string) {
  const date = new Date(value);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: STOCKHOLM });
  const dayMonth = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    timeZone: STOCKHOLM,
  });
  return `${weekday}, ${dayMonth}`;
}

/** Slack's date divider: a hairline with a pill in the middle. */
export function DateDivider({ children }: { children: ReactNode }) {
  return (
    <div className="relative my-2 flex items-center justify-center">
      <div className="absolute inset-x-0 top-1/2 border-border border-t" />
      <span className="relative rounded-full border bg-card px-3 py-1 font-bold text-[13px]">
        {children}
      </span>
    </div>
  );
}
