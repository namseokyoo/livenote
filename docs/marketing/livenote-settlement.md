# LiveNote Settlement Marketing Draft

Status: draft for Core review. Do not publish externally from this document.

## One-Line Definition

LiveNote is a no-login shared meeting note for capturing one conversation into a clean summary, decisions, and action items before the meeting ends.

## Three-Sentence Intro

LiveNote gives a host one shared note and a simple join code so participants can follow the meeting without account setup. The best settlement scenario is not "general collaborative docs"; it is a focused meeting note that moves from live discussion to summary, decisions, and action items. Current product claims should stay grounded in realtime shared capture, because automatic AI summarization has not been audited as a shipped capability in this preflight.

## Fixed Demo Scenario

Scenario: 25-minute product sync for a landing-page launch.

Participants:

- Mina: host and meeting owner.
- Joon: designer.
- Ara: engineer.
- Sam: growth.

Meeting goal:

- Decide launch-page scope.
- Capture risks.
- Leave with owner/date action items.

LiveNote flow:

1. Mina creates a note titled `Landing Page Launch Sync`.
2. Mina shares the note code and guest password.
3. Participants join with nicknames.
4. Mina structures the note with `Summary`, `Decisions`, and `Action Items`.
5. Participants follow live; host can grant edit permission when someone needs to add detail.
6. The meeting ends with the final note visible to everyone.

Claim boundary:

- Safe: LiveNote supports realtime shared meeting notes.
- Safe: LiveNote can be used to capture summary, decisions, and action items.
- Avoid until implemented and verified: LiveNote automatically generates summaries or action items.

## Example Input/Output

Example live meeting input:

```text
Title: Landing Page Launch Sync

Agenda
- Confirm first-viewport message
- Decide launch CTA
- Check analytics readiness
- Assign follow-up owners

Live notes
- Keep headline direct: "Shared meeting notes in seconds"
- Demo should show host note creation, guest join, and final action list
- CTA should be "Create a note" for product page
- Analytics event names need final review before launch
- Launch target is next Friday if QA passes by Wednesday
```

Example final output captured in LiveNote:

```text
Summary
The team aligned on a simple launch page that demonstrates fast shared meeting notes with host and guest participation. The first demo should show a host creating a note, a guest joining by code, and the team leaving with a visible action list. Launch remains targeted for next Friday, pending QA and analytics review.

Decisions
- Use "Shared meeting notes in seconds" as the first-viewport message.
- Use "Create a note" as the primary CTA.
- Keep the demo focused on create -> join -> capture action items.

Action Items
- Mina: finalize homepage copy by Tuesday.
- Joon: prepare demo visuals by Wednesday morning.
- Ara: verify QA pass and note join flow by Wednesday.
- Sam: confirm analytics event names before launch.
```

## Threads Draft

Draft only:

```text
Most meeting notes fail because they start as a blank page and end as a memory test.

LiveNote is a shared note built around the moment the meeting is still happening:

1. Create one note
2. Share the code
3. Capture the summary, decisions, and action items before people leave

No account setup. No heavy workspace. Just the meeting record everyone can see.
```

## 5-Card Card-News Script

Draft only:

Card 1:

```text
Meetings do not need more notes.
They need a clear ending.
```

Card 2:

```text
LiveNote starts with one shared note.
The host creates it. Everyone else joins by code.
```

Card 3:

```text
Use one structure:
Summary
Decisions
Action Items
```

Card 4:

```text
Participants can follow live.
The host stays in control of editing access.
```

Card 5:

```text
End the meeting with the record already written:
what happened, what was decided, and who owns the next step.
```

## 30-45s Demo Video Script

Draft only:

```text
0-5s
Show LiveNote home. Host clicks "Create note" and enters "Landing Page Launch Sync".
Voiceover: "Start with one shared meeting note."

5-12s
Show host and guest passwords, then the created note with a note code.
Voiceover: "Share the code with participants. No workspace setup required."

12-20s
Show a second participant joining with note code, password, and nickname.
Voiceover: "Guests join the same live note and can follow along immediately."

20-32s
Show the note structured as Summary, Decisions, and Action Items.
Voiceover: "Capture the meeting in the shape people need after it ends."

32-42s
Show host granting edit permission, then an action item being added.
Voiceover: "The host can keep control or let someone add details."

42-45s
Show final note with action items visible.
Voiceover: "LiveNote: leave the meeting with the record already written."
```

## Homepage Card Copy Draft

Draft for SidequestLab/Core review only:

```text
LiveNote

Shared meeting notes in seconds.

Create one note, invite participants by code, and capture the summary, decisions, and action items while the meeting is still live.

Primary CTA: Create a note
Secondary CTA: View demo

Best for:
Product syncs, planning meetings, launch reviews, and lightweight team decisions.

Capability line:
Realtime shared notes with host/guest access and controlled guest editing.
```

## README Patch Recommendation

README was not changed in this task to avoid modifying existing repository docs during a preflight-only package. Recommended later README patch:

```md
# LiveNote

LiveNote is a realtime shared note app for lightweight meetings. A host creates a note, shares a code and password, and participants join without account setup.

## Core Scenario

Use LiveNote to capture one meeting into:

- Summary
- Decisions
- Action items

## Current Capabilities

- Create and join notes by code
- Host and guest passwords
- Realtime TipTap-based editor
- Presence and host-controlled guest edit permission
- Recent notes and search

## Local Development

\`\`\`bash
npm run dev
\`\`\`
```

## Core Review Questions

- Should settlement copy stay English, Korean, or bilingual for the first homepage card?
- Should the homepage card say "no-login" if password-based note access is the primary access model?
- Should "summary/decisions/action items" become an in-product template later, or remain marketing guidance only?
- Is "meeting notes" narrow enough, or should the card say "team decisions" to leave room for broader workflows?
