# Submission

## What I built, and for whom

**Menti Orchestrator**, a service inside MentOS that does the Closed Won
hand-off. It listens to Salesforce events, checks each deal against the
finance rules (R1 to R8), sets the customer up in the admin app, drafts the
invoice in Kleer or charges the card in Stripe, writes the IDs back to
Salesforce and tells the one person who can fix what is missing, in Slack.

Built for finance and RevOps first: Maja reviews drafts instead of copying,
Tom hears when a card fails, Kim gets a log instead of relaying. Reps get one
DM per deal with the exact field to fix. The CSM gets a DM when the workspace
exists.

On this week's deals: 9 done, 6 set up with billing on hold, 2 blocked,
1 reopened. Nothing is created twice.

## Decisions

- Automate everything except sending. Kleer invoices stop at draft, Maja
  sends. Cards are charged directly, so R2 keeps them under 10,000 EUR.
- Set the customer up, hold the money. A missing PO, VAT or approval holds
  the invoice, not the workspace. Only unclear data (license counts disagree,
  two candidate workspaces) stops setup.
- Act on the deal as it is now, not the event snapshot. Halden's 30 to 35
  licenses is a no-op.
- Match workspaces by domain. One match is linked both ways, two is a human
  choice, none creates one.
- Add-ons prorate by day and co-term (R6). Plan moves end the old
  subscription and stop the old card (R7). Multi-year bills year one.
- The systems are the truth, the orchestrator's state is a cache. If it loses
  its memory it rebuilds what it did from the systems before planning.
- Rules only, no AI. Every finding has a rule, an owner and a field.
- Not built: a daily digest for reps, rollback when a deal reopens after
  setup, real exchange rates, Deal Desk approval inside MentOS.
- One mock change: the admin app records an `X-Created-By` header so
  subscriptions say "Menti Orchestrator" instead of "api".

## Before it goes live

- Tom: is "access now, invoice later" acceptable, or should a pending Deal
  Desk approval block setup too?
- Finance and RMs: do long-standing customers get the PO exemption?
- Kim: should `Handoff_Issues__c` drive a validation rule so reps see it
  before they close?
- Who maintains the exchange rates for R2.
- Can the admin app and Stripe publish events, so the orchestrator reacts
  to things it did not start?

## How to try it

`npm install`, `npm run dev`, open http://localhost:3000.

1. Home, press **Open Menti Orchestrator**, then **Sync Salesforce events**
   (or Dev tools, **Send all 21 to webhook**).
2. Press **Needs action**. Open Kessler (PO missing), Helix (pick a
   workspace), Nordlys (old card stopped, Kleer draft with VAT), Halden
   (prorated add-on).
3. Deals, Open, Orbital Freight, **Mark Closed Won**. It lands on its case as
   held. **Open in Salesforce**, fill in a PO number under Edit, save. The
   case is done, the draft is in Kleer, Maja has the link in
   `#finance-billing`.
4. `npm test` runs the whole week in memory and checks every rule.

`GET /api/orchestrator` lists the API. `docs/as-is-flow.html` and
`docs/system-map.html` are the diagrams I made before building.

## What I'd do next

- A daily digest per rep.
- React to Stripe and admin app events (failed renewals, self-service
  signups).
- Deal Desk approval that writes `Discount_Approval__c` and re-runs.
- Thresholds (card limit, discount limit, payment terms) as config finance
  can edit.

## Working with your AI tool

The whole session was in Swedish, dictated by voice. Your first prompt,
pasted as I wrote it, with a translation underneath:

> Okay, so jag har forkat ett repo och det här kommer vara då min business case för min ansökan som RevOps engineer. På Mentimeter. Och jag tror att mycket av det du behöver veta finns redan i detta forkade repot. Bland annat mina förhållanden, vad du ska förhålla dig till och liknande. Så jag vill att du börjar med att egentligen titta igenom allting så att du skapar dig en uppfattning av allting. Jag kommer använda mycket inspelning via röst. Så jag kommer inte skriva mycket, så ibland kanske de här texterna eller mina prompts till dig kommer vara lite grammatiskt fel kanske ibland att det står lite på engelska eller liknande för den speech-to-text-vägen. Är lite svajig ibland. Men jag vill att du försöker förstå där jag skriver. I någon slags overall kontext. Och när det är specifika saker och så vidare. Men börja med att kolla igenom projektet här. Och sen så ska vi ta oss an det och ge ungefär en 3 timmar från och med nu. Klockan är ungefär 15 just nu. Så vi är klockan 6 så är vi väl klara om inte innan.

> *Translation:* Okay, so I have forked a repo and this will be my business
> case for my application as RevOps Engineer at Mentimeter. I think most of
> what you need to know is already in this forked repo, including my
> constraints and what you should relate to. So I want you to start by
> looking through everything so you form a picture of it all. I will mostly
> use voice recording, so I will not write much, and sometimes these texts
> or my prompts will be a bit grammatically off, or partly in English,
> because the speech-to-text is a bit shaky. But I want you to try to
> understand what I write in an overall context, and the specifics when
> there are any. Start by looking through the project. Then we take it on,
> with about 3 hours from now. It is about 15:00 now, so by 18:00 we should
> be done, if not before.

The full session export (Swedish) is in
`docs/session/claude-code-session.txt`.

Something your tool suggested or built that you changed or threw away:

- It jumped to solution options after reading the repo. I stopped it and
  spent the first hour on the business, the roles and the current flow.
- It missed that the orchestrator could lose its state while the systems
  kept theirs. Found while testing: a second Nordlys subscription. Fixed by
  rebuilding state from the systems.
- Smaller misses I caught in the output: it counted its own new subscription
  as a duplicate, double-counted Halden's seats, DM'd a rep about a deal he
  reopened himself, and told nobody when an account had no CSM.
- I asked for three case page layouts and kept one.

Roughly where you spent your time:

- 1 h understanding the business, data and current flow.
- 45 min deciding and building.
- 1 h running it on the data, clicking through, fixing.
- 15 min on this document.

## Video

https://github.com/user-attachments/assets/f060765b-ba77-48fa-af5f-50fc2caa4128,
a screen recording with voice-over, in the repo. GitHub plays it in the
browser.
