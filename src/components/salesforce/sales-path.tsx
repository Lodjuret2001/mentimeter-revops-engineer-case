import { Check } from 'lucide-react';
import { LightningCard } from '@/components/salesforce/lightning';
import { cn } from '@/lib/utils';

const OPEN_STAGES = ['Qualification', 'Proposal', 'Negotiation'];

const CHEVRON =
  '[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%,12px_50%)]';
const FIRST_CHEVRON =
  '[clip-path:polygon(0_0,calc(100%-12px)_0,100%_50%,calc(100%-12px)_100%,0_100%)]';
const LAST_CHEVRON = '[clip-path:polygon(0_0,100%_0,100%_100%,0_100%,12px_50%)]';

/**
 * Lightning's Sales Path: one chevron per stage, completed stages in navy,
 * the current stage in blue, Closed Won in green and Closed Lost in red.
 */
export function SalesPath({
  stage,
  isClosed,
  isWon,
}: {
  stage: string;
  isClosed: boolean;
  isWon: boolean;
}) {
  // Show the deal's real stage even when it is not one of the usual ones.
  const open = isClosed || OPEN_STAGES.includes(stage) ? OPEN_STAGES : [...OPEN_STAGES, stage];
  const closedLabel = isClosed ? stage : 'Closed';
  const stages = [...open, closedLabel];
  const currentIndex = isClosed ? stages.length - 1 : stages.indexOf(stage);

  return (
    <LightningCard className="px-4 py-3">
      <ol className="flex gap-0.5" aria-label="Sales path">
        {stages.map((name, index) => {
          const isCurrent = index === currentIndex;
          const isComplete = index < currentIndex;
          const isLast = index === stages.length - 1;
          const tone = isCurrent
            ? isClosed
              ? isWon
                ? 'bg-[#2e844a] text-white'
                : 'bg-[#ba0517] text-white'
              : 'bg-[#0176d3] text-white'
            : isComplete
              ? 'bg-[#032d60] text-white dark:bg-[#1b4f8f]'
              : 'bg-[#e5e5e5] text-foreground/80 dark:bg-muted dark:text-muted-foreground';
          return (
            <li
              key={name}
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'flex h-8 flex-1 items-center justify-center gap-1 px-4 font-semibold text-[12px]',
                index === 0 ? FIRST_CHEVRON : isLast ? LAST_CHEVRON : CHEVRON,
                tone,
              )}
            >
              {isComplete ? <Check className="size-3.5" aria-hidden /> : null}
              <span className="truncate">{name}</span>
            </li>
          );
        })}
      </ol>
    </LightningCard>
  );
}
