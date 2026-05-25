# Spec: LiveNote Access UX Phases 1-6

Task ID: 2026-05-25-livenote-access-ux

## Intent Lock
Implement the commander-approved plan through Phase 6 only. Design overhaul is explicitly deferred to the next sprint.

## Required behavior
- Default note visibility remains public.
- Users may select an unlisted/private-link option at creation.
- Unlisted notes are reachable by note code/link but excluded from public recent/search listing.
- Create flow explains 4-digit password rules and warns that unlisted note links/codes must be saved.
- Join flow gives clear loading/error feedback and states that code/link is needed.
- Landing has one concise service-feature line; detailed password/share/privacy copy belongs in creation/editor flows.
- Editor shows share/code guidance and a prominent read-only guest notice.
- Console warnings introduced by this work should be fixed, not hidden.

## Negative criteria
- No account/login/private dashboard feature.
- No redesign beyond minimal copy/layout affordances.
- No deploy/push/tag/merge or external service mutation.
