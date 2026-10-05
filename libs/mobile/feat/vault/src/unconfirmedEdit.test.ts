import { draftSheetBusy, settleConflictReload } from './unconfirmedEdit';

describe('settleConflictReload', () => {
  it('keeps the note on its row while the edit is still held', () => {
    expect(settleConflictReload('held')).toEqual({
      keepReverted: true,
      sent: false,
    });
  });

  it('clears the note and reports the send once the edit is on the server', () => {
    expect(settleConflictReload('sent')).toEqual({
      keepReverted: false,
      sent: true,
    });
  });

  it('clears the note without reporting a send when nothing is held', () => {
    expect(settleConflictReload('pulled')).toEqual({
      keepReverted: false,
      sent: false,
    });
  });
});

describe('draftSheetBusy', () => {
  it('is free when nothing is in flight', () => {
    expect(draftSheetBusy({ pendingId: null, refreshing: false })).toBe(false);
  });

  it('is busy while the draft is being pushed', () => {
    expect(draftSheetBusy({ pendingId: 's1', refreshing: false })).toBe(true);
  });

  it('is busy while a reload may be sending a refused draft', () => {
    expect(draftSheetBusy({ pendingId: null, refreshing: true })).toBe(true);
  });
});
