// Which Users this installation has already offered Biometric Unlock to.
//
// ADR 0108 decision 1 offers it *once*, after a passphrase unlock, and puts
// every later chance to turn it on in Account. Remembering the offer is what
// makes that true: without it, a User who declined is asked again on every
// passphrase unlock, which is the shape of a nag rather than an offer.
//
// A Device Setting, because it is a fact about this installation — the
// keystore item the offer leads to lives on this device and nowhere else. Held
// as User ids so the answer is per User, the same ownership rule the keystore
// item itself follows: another User signing in here has not been offered
// anything.
//
// Separate from the store for the reason ./appearance.ts is: the store's MMKV
// import makes anything reaching it untestable, and the branch worth testing
// is the one that only runs on a value this build did not write.

/**
 * The ids in a stored offer list, or none when the store holds nothing usable
 * — nothing written yet, or anything that is not a JSON array of strings.
 *
 * A list that will not parse is read as "nobody has been offered", which
 * re-offers rather than suppresses. That direction is chosen deliberately: the
 * cost of getting it wrong here is one sheet the User dismisses, and the cost
 * the other way is a User who is never told the feature exists.
 */
export function toOfferedUserIds(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === 'string');
}

/** The list with this User added, unchanged when it is already there. */
export function withOfferedUserId(
  offered: readonly string[],
  userId: string,
): readonly string[] {
  return offered.includes(userId) ? offered : [...offered, userId];
}

/** The list as the store holds it. */
export function serializeOfferedUserIds(offered: readonly string[]): string {
  return JSON.stringify(offered);
}
