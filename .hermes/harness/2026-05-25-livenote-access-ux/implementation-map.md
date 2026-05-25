# Implementation Map

Planned paths:

- `docs/plans/2026-05-25-livenote-access-ux-goal-plan.md` — execution contract.
- `src/types/note.ts` — shared visibility type on notes/create input.
- `src/lib/note-service-firebase.ts` — store and list-filter visibility.
- `src/app/api/notes/route.ts` — validate/accept visibility.
- `src/app/api/notes/[code]/route.ts` — expose visibility if needed by editor page.
- `src/components/CreateNoteForm.tsx` — selector/guidance/loading.
- `src/components/JoinNoteForm.tsx` — feedback/guidance/loading.
- `src/app/page.tsx` — concise landing value prop.
- `src/components/NoteEditor.tsx` — share/read-only guidance.
- `.hermes/harness/2026-05-25-livenote-access-ux/*` — evidence/report.
