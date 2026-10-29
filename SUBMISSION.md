# Submission

## What I built, and for whom

**Menti Orchestrator**: a service inside MentOS that takes over the Closed Won
hand-off. It listens to Salesforce events, checks every deal against the
finance checklist (R1 to R8) and the data, sets the customer up in the admin
app, drafts the invoice in Kleer or creates the Stripe subscription, writes
the IDs and a status back to Salesforce, and tells the one person who can fix
each problem in Slack.

It is built for **finance and RevOps first**: Maja stops copying and starts
reviewing drafts, Tom hears about failed cards the minute they fail, Kim gets a
log instead of being the relay. Reps are second: they get one Slack DM per deal
with exactly which Salesforce fields to fix, and the deal page shows what
happened. Lea gets a DM the moment a workspace exists, so her kickoff has
somewhere to happen.

The orchestrator is its own API at `/api/orchestrator/*` (Hono, same pattern
as the mocks) with a UI at `/orchestrator`. The systems are left exactly as
they are; everything new lives in `src/lib/orchestrator`.

How a Closed Won event is handled, in order:

1. Receive the event (webhook or `/sync` from the feed). Skip if that replayId
   was already handled.
2. Collect the deal as it looks **now** (not the event snapshot), the account,
   billing contact, line items, price book, the original deal for add-ons and
   renewals, and what already exists in the admin app, Kleer and Stripe.
3. Assess: every finding gets a severity (`info`, `warn`, `hold`, `block`) and
   an owner (rep, finance, credit control, RevOps, Deal Desk).
4. Plan: setup actions (workspace, plan, subscription, end the old one) and
   billing actions (Kleer draft or Stripe subscription).
5. Run setup unless something is `block`.
6. Run billing only if nothing is `hold` or `block`.
7. Write back to Salesforce: `Subscription_ID__c`, `Invoice_Number__c`,
   `Billing_Reference__c`, `Handoff_Status__c`, `Handoff_Issues__c`, and the
   account's `Workspace_ID__c` and `Kleer_Customer_Number__c`.
8. Slack, only when something changed since last time: deal owner, CSM,
   `#finance-billing`, `#deal-desk`, credit controller.
9. Save the case and the log.

On this week's data that gives 9 deals done, 6 set up with billing held, 2
blocked and 1 reopened. Seven Kleer drafts, two card subscriptions, two old
card subscriptions stopped, no duplicates when events are sent twice.

## Decisions

- **Automate everything except sending.** Maja wants to see every invoice, so
  Kleer invoices stop at draft and "Send invoice" is a button. Stripe has no
  draft, so cards are charged directly, which R2 limits to 10,000 EUR.
- **Do the harmless, hold the money.** When a deal has a `hold` finding (PO
  missing, VAT missing, discount pending, card over the limit, currency
  mismatch) the workspace and subscription are still created so the customer
  has access on the start date (Lea), but nothing is invoiced or charged
  (Tom, Maja). Only `block` findings (license count conflict, two candidate
  workspaces, deal not Closed Won) stop setup too.
- **The current opportunity wins over the event snapshot.** Halden & Co was
  closed as 30 licenses and corrected to 35 two days later; acting on the
  record as it is now means the first event already produces the right
  numbers, and the correction is a no-op.
- **Workspaces are matched by domain.** Kessler, Corvid and Helix already use
  Mentimeter self-service. One match is linked both ways (account gets
  `Workspace_ID__c`, workspace gets `salesforceAccountId`). Two matches (Helix
  R&D and Helix Commercial) block until a human picks one, which is one
  click. No match creates a workspace.
- **R6 proration** uses days left over days in the existing period, with the
  discount folded into the unit price so Kleer's own maths still adds up:
  Halden pays 3,134.60 GBP for 111 of 365 days, not the 10,307.50 in
  Salesforce.
- **R7**: a new deal on an account with a live subscription is a plan move.
  Nordlys' card subscription ends the day before the new contract starts, so
  it is set to not renew. Sable & Finch's overlaps, so it is cancelled now and
  the admin subscription ended the day before the new one.
- **Multi-year, invoiced annually** (Torvik) bills year one and schedules a
  two-year subscription; the finding says when year two is due.
- **R2 needs exchange rates** and the case has none. I used rough constants
  (USD 0.92, GBP 1.17, SEK 0.088 per EUR) and wrote them in one place.
- **Wavecrest**: `Payment_Method__c` wins over the legacy card checkbox, with
  a warning to the rep.
- **Arcadia**: "FR 12 3456" fails a simple shape check for EU VAT numbers.
  Kleer would accept it and charge no VAT; I would rather hold the invoice.
- **Maris** is held for finance to decide the currency (deal in EUR, account
  in CHF, no CHF price list).
- **Corvid** is blocked, not guessed: the rep says 8, the record says 10.
- **Kessler** gets no RM exemption from R3. It is a new customer and the
  exemption is not decided, so I followed the rule and the reasons are in
  the Slack DM.
- **Polar Bear** (reopened) is never set up and nobody is pinged.
- **State is a cache, systems are the truth.** If the orchestrator's own
  memory is reset it rebuilds what it did from the systems (subscription by
  ID or twin, invoice by `foreignId`, Stripe subscription by metadata) before
  planning, so it never creates twice.

What I chose not to build: Alex's one-message-a-day digest, automatic rollback
when a deal is reopened after setup (it flags finance instead), the Scheduled
to Active flip on the start date (the admin app's job), real exchange rates,
an approval flow for Deal Desk inside MentOS, and any AI calls.

I did not change the mocks. The only config change is excluding the two HTML
diagrams in `docs/` from Biome.

## Before it goes live

- Finance: is "set the customer up but hold the money" acceptable for a deal
  with a pending Deal Desk approval, or should that block setup too? Tom's
  answer could move `DD` from `hold` to `block`.
- Finance and RMs: do long-standing customers get the R3 exemption? If yes,
  the rule needs a definition of "long-standing" (account type Customer, or
  an age) and the PO hold becomes a warning for them.
- Kim: who owns the `Handoff_*__c` fields in Salesforce, and should
  `Handoff_Issues__c` drive a report or a validation rule so reps see it
  before they close?
- Lea: is a Scheduled subscription enough for the kickoff, or does the
  workspace plan need to flip only on the start date? Today the plan is set
  immediately.
- The admin app team: can it publish events (subscription activated,
  self-service workspace created) so the orchestrator can react to things it
  did not cause?
- Which exchange rates and who maintains them.

## How to try it

`npm install`, `npm run dev`, open http://localhost:3000.

1. **Menti Orchestrator** in the sidebar, press **Sync Salesforce events**.
   Or go to **Dev tools** and press **Send all 21 to webhook**; the webhook
   hands each event to the orchestrator.
2. Open **Nordlys Energi** for a clean plan move (old card subscription
   stopped, Kleer draft with 25% VAT), **Halden & Co** for the prorated
   add-on, **Kessler Logistik** for a hold on a missing PO, **Helix Pharma**
   for the workspace choice buttons.
3. Fix something in Salesforce and run again, for example:

   ```bash
   curl -X PATCH localhost:3000/api/mock/salesforce/opportunities/006Wb0000000lqRAAK \
     -H 'content-type: application/json' -d '{"PO_Number__c":"PO-KL-5001"}'
   curl -X POST localhost:3000/api/orchestrator/cases/006Wb0000000lqRAAK/run
   ```

   Kessler goes from held to done and Maja gets the draft.
4. **Slack** shows every DM and channel message; **Deals** shows the
   write-back on each opportunity; **Kleer**, **Stripe** and **Admin app**
   show what was created. **Dev tools, Request log** shows every call.
5. `npm test` runs the whole week in memory and checks each rule against the
   data (`test/orchestrator.test.ts`).

`GET /api/orchestrator` lists the API. `docs/as-is-flow.html` and
`docs/system-map.html` are the diagrams I made to understand the current
hand-off and the data ownership before building.

## What I'd do next

- A daily digest per rep instead of one DM per deal.
- Listen to Stripe and admin app events (failed renewals, self-service
  signups) so the orchestrator reacts to things it did not start.
- A Deal Desk approval flow that writes `Discount_Approval__c` and re-runs.
- Move the rule thresholds (card limit, discount limit, payment terms) into
  configuration finance can edit.
- A Salesforce validation rule that surfaces `Handoff_Issues__c` before close,
  so Priya still closes first but sees what she owes.

## Working with your AI tool

Your first prompt, pasted as you wrote it:

> Okay, so jag har forkat ett repo och det här kommer vara då min business case för min ansökan som RevOps engineer. På Mentimeter. Och jag tror att mycket av det du behöver veta finns redan i detta forkade repot. Bland annat mina förhållanden, vad du ska förhålla dig till och liknande. Så jag vill att du börjar med att egentligen titta igenom allting så att du skapar dig en uppfattning av allting. Jag kommer använda mycket inspelning via röst. Så jag kommer inte skriva mycket, så ibland kanske de här texterna eller mina prompts till dig kommer vara lite grammatiskt fel kanske ibland att det står lite på engelska eller liknande för den speech-to-text-vägen. Är lite svajig ibland. Men jag vill att du försöker förstå där jag skriver. I någon slags overall kontext. Och när det är specifika saker och så vidare. Men börja med att kolla igenom projektet här. Och sen så ska vi ta oss an det och ge ungefär en 3 timmar från och med nu. Klockan är ungefär 15 just nu. Så vi är klockan 6 så är vi väl klara om inte innan.

The full session export is in `docs/session/` (see the Video section for the
walkthrough).

Something your tool suggested or built that you changed or threw away, and
why:

- After reading the repo it immediately laid out three solution directions and
  asked me to pick. I stopped it. I wanted to understand the business, the
  roles and how the hand-off works today before talking solutions, so we spent
  the first hour on that instead, including the two diagrams in `docs/`. The
  solution we ended up with is close to its first suggestion, but now I can
  explain every piece of it.
- It did not think of the case where the orchestrator loses its own state
  while the systems keep theirs. I found it while verifying against the data:
  resetting the orchestrator and syncing again created a second Nordlys
  subscription. The fix is to rebuild "what did I already do" from the
  systems before planning.
- Three smaller things it got wrong on the first run and I caught in the
  output: it counted the subscription it had just created as a "second live
  subscription" on Nordlys, it double-counted Halden's added seats on the
  second event, and it DM'd Sam about Polar Bear, a deal Sam reopened
  himself.
- It wanted to import the EU country list from the Kleer mock. The mock is
  third-party code, so the orchestrator has its own list.

Roughly where you spent your time:

- About 1 hour 15 minutes understanding the business, the roles, the data and
  the current flow, and getting the diagrams made.
- About 45 minutes deciding what to build and watching it get built.
- About 45 minutes running it on the week's data, reading the output deal by
  deal, and fixing what was wrong.
- About 15 minutes on this document.

## Video

Link:
