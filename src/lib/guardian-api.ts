import { http } from "@/lib/api";
/** Admin: unlink a guardian / parent account from a child (history kept). DELETE /children/:id/guardians/:guardianId {reason}; 400 without reason. */
export const unlinkGuardian = (childId: string, guardianId: string, reason: string) =>
  http.del<unknown>(`/children/${childId}/guardians/${guardianId}`, { reason });
