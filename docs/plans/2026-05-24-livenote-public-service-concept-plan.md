# LiveNote Public Service Concept Plan

Status: draft plan for Core review. Do not publish externally from this document.

## Positioning

LiveNote should be presented as a lightweight public web service for ending small meetings with a shared written record already visible to everyone.

Public-facing one-liner:

> LiveNote is a no-login shared meeting note: create one note, share a code, and leave with summary, decisions, and action items written together.

## Claim Boundary

Safe public claims for the next release:

- No-account note creation and join-by-code flow.
- Host and guest password separation.
- Realtime shared note capture.
- Host-controlled guest editing permission.
- Human-authored Summary / Decisions / Action Items meeting structure.
- Firebase-backed persistence after refresh.

Do **not** claim yet:

- Automatic AI summarization.
- Automatic action-item extraction.
- Enterprise security/compliance.
- Public production readiness until Firebase Hosting / Cloud Run preview, company-network access, and cleanup gates pass.

## Target User / Use Case

Primary user:

- A meeting owner who needs a fast shared note without setting up a workspace or asking everyone to log in.

Best first use cases:

1. Product syncs
2. Launch reviews
3. Planning meetings
4. Lightweight project decisions
5. Small study / lab sessions

Non-goal for first public positioning:

- Replacing Notion, Google Docs, Slack Canvas, or enterprise knowledge bases.
- Long-lived document management.
- Organization-level account/admin features.

## Public Demo Flow

The public demo should prove one tight story:

1. Host creates a note titled `Landing Page Launch Sync`.
2. Host shares the generated note code and guest password.
3. Guest joins with nickname.
4. Host writes sections:
   - Summary
   - Decisions
   - Action Items
5. Host grants edit permission to guest.
6. Guest adds one action item.
7. Host/guest refresh or reconnect and the content persists.

Required demo evidence before publication:

- Screenshot or short recording of host create flow.
- Screenshot or short recording of guest join flow.
- Screenshot or short recording of edit-permission toggle.
- Screenshot or short recording of refresh persistence.
- E2E run showing `S1-05` persistence PASS with an assertion, not a warning.
- E2E run showing host/guest collaboration PASS.

## Product Work Needed Before Public Launch

### P0 — Must finish before public exposure

- Persistence after refresh must be a hard PASS regression (`S1-05`).
- Host/guest collaboration E2E must remain committed and runnable.
- Test-created notes should be cleaned up or clearly isolated so demo/public data is not polluted.
- README and public copy must avoid unsupported AI or enterprise claims.
- Deployment URL and branch/release boundary must be documented.
- Basic privacy wording must tell users not to enter secrets or sensitive personal/company data during beta.

### P1 — Strongly recommended for first beta

- Add an explicit note expiration / cleanup policy.
- Add a simple “copy invite” UX that includes code + guest password instructions without leaking host password.
- Add a visible “saved” state that reflects canonical persistence, not only local editor state.
- Add a demo seed scenario or scripted QA fixture.
- Add minimal error messaging for realtime save failures.

### P2 — Later differentiation

- AI-generated meeting summary after manual trigger.
- Action item extraction with owner/date suggestions.
- Export to Markdown.
- Read-only share link.
- Optional room templates for meeting types.

## Launch Gate Sequence

1. **Local regression gate**
   - `npm run lint`
   - `npm run test`
   - `npm run build`
   - `npm run test:e2e -- --list`
   - Focused `S1-05` persistence E2E PASS
   - Host/guest collaboration E2E PASS

2. **Preview deployment gate**
   - Deploy only after approval.
   - Verify Firebase Hosting rewrite to Cloud Run.
   - Verify public env vars and server-only secrets separation.
   - Verify no generated/private artifacts are published.

3. **Public concept gate**
   - Publish only the safe one-liner and demo scenario.
   - Use the existing meeting-note positioning; avoid “AI meeting assistant” language until implemented.
   - Prepare a short demo video/card-news asset after the product gates pass.

4. **Beta hygiene gate**
   - Add cleanup policy.
   - Add lightweight privacy/disclaimer copy.
   - Add observability/error capture review.
   - Re-run deployed E2E and cleanup test-created notes.

## Verification Checklist

- [ ] `S1-05` no longer prints `WARNING`; it asserts and passes.
- [ ] Host/guest E2E is committed as a regression test.
- [ ] Public copy says “human-captured” or equivalent, not “AI-generated”.
- [ ] Persistence and collaboration evidence are attached to the release notes or harness.
- [ ] No service account, pepper, token, or private meeting content appears in committed files.
- [ ] External publication remains blocked until 형 explicitly approves it.
