/**
 * P0 backend contract: a guardian phone matching an existing parent account with a DIFFERENT name is a row error
 * `code: "PHONE_NAME_MISMATCH"` with `existingAccount {userId, name, childrenCount}`; it blocks the import unless the admin
 * confirms that row via multipart field `confirmLinks` = JSON `[{"row":5,"guardian":2}]` (row = Excel row, guardian 1|2).
 * Accepted in dryRun too (row becomes valid with a warning); must be sent again with the real import.
 */
export type LinkErr = { row: number | null; column: string | null; field?: string; value?: unknown; message: string;
  code?: string; existingAccount?: { userId: string; name: string; childrenCount?: number } | null; /** same phone, other name, earlier row of THIS file */ conflictRow?: number | null };
export type LinkKey = { row: number; guardian: 1 | 2; phone: string; name: string; childrenCount?: number; conflictRow?: number | null };
export const CONFIRM_FIELD = "confirmLinks";
export const MISMATCH_CODE = "PHONE_NAME_MISMATCH";
export const linkKey = (row: number, guardian: number) => `${row}:${guardian}`;

/** guardian slot from the error field (g1Phone / g2Phone…) or the column header ("… 2 …"). */
const slotOf = (e: LinkErr): 1 | 2 => (/^g2/.test(e.field ?? "") || /\b2\b/.test(e.column ?? "") ? 2 : 1);
export function asMismatch(e: LinkErr): LinkKey | null {
  if (e.code !== MISMATCH_CODE || e.row == null) return null;
  return { row: e.row, guardian: slotOf(e), phone: String(e.value ?? ""), name: e.existingAccount?.name ?? (e.conflictRow ? `ở dòng ${e.conflictRow}` : "(tài khoản có sẵn)"), childrenCount: e.existingAccount?.childrenCount, conflictRow: e.existingAccount ? null : e.conflictRow ?? null };
}
export const appendConfirm = (fd: FormData, links: LinkKey[]) => {
  if (links.length) fd.append(CONFIRM_FIELD, JSON.stringify(links.map(l => ({ row: l.row, guardian: l.guardian }))));
  return fd;
};
