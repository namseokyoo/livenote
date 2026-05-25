import { describe, expect, it } from 'vitest';
import { mapAdminNote, normalizeNoteVisibility } from '../src/lib/note-service-firebase';

describe('note visibility', () => {
  it('defaults missing and invalid visibility values to public', () => {
    expect(normalizeNoteVisibility(undefined)).toBe('public');
    expect(normalizeNoteVisibility('private')).toBe('public');
  });

  it('preserves unlisted visibility on note mapping', () => {
    const note = mapAdminNote('note-1', {
      noteCode: 'ABC123',
      title: 'Unlisted note',
      visibility: 'unlisted',
      createdAt: 1_000,
      lastModified: 1_000,
    });

    expect(note.visibility).toBe('unlisted');
  });
});
