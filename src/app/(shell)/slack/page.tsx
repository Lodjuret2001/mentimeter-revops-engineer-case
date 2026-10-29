import { ChevronDown, CornerDownRight, Hash, Plus, Search, SendHorizontal } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  AppTag,
  DateDivider,
  SlackAvatar,
  SlackMessageText,
  slackDay,
  slackDayLabel,
  slackTime,
} from '@/components/slack/ui';
import { slack } from '@/lib/connectors';
import { formatDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Slack' };

export default async function SlackPage(props: PageProps<'/slack'>) {
  const { channel } = await props.searchParams;
  const [channels, users, direct] = await Promise.all([
    slack.listChannels(),
    slack.listUsers(),
    slack.listDirectMessages(),
  ]);
  const directIds = direct.map((d) => d.user);
  const selected = typeof channel === 'string' ? channel : (channels[0]?.id ?? '');
  const isDirect = directIds.includes(selected);
  const messages = await slack.history(selected).catch(() => []);
  const person = (id: string) => users.find((u) => u.id === id);
  const selectedChannel = channels.find((c) => c.id === selected);
  const title = isDirect
    ? `Direct messages to ${person(selected)?.real_name ?? selected}`
    : `#${selectedChannel?.name ?? ''}`;
  const subtitle = isDirect ? person(selected)?.title : selectedChannel?.purpose;

  // The API returns newest first; Slack reads top to bottom, oldest first.
  const timeline = [...messages].sort((a, b) => a.postedAt.localeCompare(b.postedAt));

  const sideItem =
    'flex h-7 items-center gap-2 rounded-md px-2 text-[15px] text-white/70 hover:bg-white/10 hover:text-white';
  const sideActive = 'bg-[#1164a3] text-white hover:bg-[#1164a3] hover:text-white';

  return (
    <div className="flex min-h-[calc(100vh-3rem)] flex-col bg-card text-card-foreground">
      <div className="grid flex-1 md:grid-cols-[260px_1fr]">
        {/* Workspace sidebar, in Slack's aubergine in both colour modes. */}
        <aside className="flex flex-col bg-[#3f0e40] text-white">
          <div className="flex h-12 shrink-0 items-center justify-between border-white/10 border-b px-4">
            <span className="flex items-center gap-1 font-bold text-[18px]">
              Mentimeter
              <ChevronDown className="size-4 text-white/70" />
            </span>
            <span className="flex size-8 items-center justify-center rounded-full bg-white text-[#3f0e40]">
              <Plus className="size-4" strokeWidth={2.5} />
            </span>
          </div>
          <nav className="flex flex-col gap-0.5 px-3 py-3">
            <SidebarGroup label="Channels">
              {channels.map((c) => (
                <Link
                  key={c.id}
                  href={`/slack?channel=${c.id}`}
                  className={cn(sideItem, c.id === selected && sideActive)}
                >
                  <Hash className="size-4 shrink-0 opacity-70" />
                  <span className="truncate">{c.name}</span>
                </Link>
              ))}
            </SidebarGroup>
            <SidebarGroup label="Direct messages" className="mt-4">
              {directIds.length === 0 ? (
                <div className="px-2 py-1 text-[13px] text-white/50">None yet</div>
              ) : null}
              {directIds.map((id) => {
                const name = person(id)?.real_name ?? id;
                return (
                  <Link
                    key={id}
                    href={`/slack?channel=${id}`}
                    className={cn(sideItem, id === selected && sideActive)}
                  >
                    <SlackAvatar id={id} name={name} className="size-5 rounded-[4px] text-[9px]" />
                    <span className="truncate">{name}</span>
                  </Link>
                );
              })}
            </SidebarGroup>
          </nav>
        </aside>

        {/* Conversation pane. */}
        <section className="flex min-w-0 flex-col">
          <header className="flex min-h-12 shrink-0 items-center justify-between gap-4 border-b px-5 py-2">
            <div className="min-w-0">
              <h1 className="flex items-center gap-1 truncate font-black text-[18px] leading-tight">
                {title}
                <ChevronDown className="size-4 text-muted-foreground" />
              </h1>
              {subtitle ? (
                <p className="truncate text-[13px] text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
            <span className="hidden h-7 items-center gap-2 rounded-md border px-2 text-[13px] text-muted-foreground sm:flex">
              <Search className="size-3.5" />
              Search
            </span>
          </header>

          <div className="flex flex-1 flex-col justify-end gap-0.5 px-5 py-4">
            {timeline.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
                <Hash className="size-8 text-muted-foreground" />
                <p className="font-bold text-[15px]">This is the start of {title}</p>
                <p className="text-[13px] text-muted-foreground">No messages yet.</p>
              </div>
            ) : null}
            {timeline.map((m, i) => {
              const author = person(m.user);
              const name = author?.real_name ?? 'Your app';
              const isApp = !author || author.is_bot === true;
              const previous = timeline[i - 1];
              const newDay = !previous || slackDay(previous.postedAt) !== slackDay(m.postedAt);
              return (
                <div key={m.ts}>
                  {newDay ? <DateDivider>{slackDayLabel(m.postedAt)}</DateDivider> : null}
                  <div
                    className={cn(
                      '-mx-2 flex gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50',
                      m.threadTs ? 'ml-9' : null,
                    )}
                  >
                    {m.threadTs ? (
                      <CornerDownRight className="mt-2 size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                    <SlackAvatar id={m.user} name={author ? name : 'APP'} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 leading-tight">
                        <span className="font-black text-[15px]">{name}</span>
                        {isApp ? <AppTag /> : null}
                        <span
                          className="text-[12px] text-muted-foreground"
                          title={formatDateTime(m.postedAt)}
                        >
                          {slackTime(m.postedAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[15px] leading-[1.46]">
                        <SlackMessageText text={m.text} users={users} />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Slack's composer, decoration only. */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[15px] text-muted-foreground shadow-xs">
              <span className="truncate">Message {title}</span>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                <SendHorizontal className="size-4" />
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SidebarGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', className)}>
      <div className="flex h-7 items-center gap-1 px-2 text-[15px] text-white/70">
        <ChevronDown className="size-3.5" />
        {label}
      </div>
      {children}
    </div>
  );
}
