/**
 * Wave 3 · class photo album — /workspace/mamnon-backend/docs/round3-api.md §2 (4e060e9, contract only, not implemented yet).
 * photosFeature() detects the routes in Swagger; until then the screen shows MOCK data and posting is disabled ("Sắp có").
 * Rules: tagging a child without consent → 422 PHOTO_CONSENT_MISSING {children:[{childId,name}]} (nothing saved). Consent withdrawn →
 * photos auto-hidden (hiddenReason CONSENT_WITHDRAWN, hiddenChildIds); re-consent does NOT unhide; teacher may unhide only when all tagged
 * children consent; untagging never unhides. Files only via the authenticated endpoint (blobUrl). No face blur.
 */
import { API_ORIGIN, http, softGet } from "@/lib/api";

export type PostPhoto = { id: string; width?: number; height?: number; childIds: string[]; /** parent: tags my child */ mine?: boolean;
  children?: { childId: string; name: string }[];
  hidden: boolean; hiddenReason: "CONSENT_WITHDRAWN" | string | null; /** sticky (09b792e) */ hiddenForChildIds?: string[]; hiddenAt?: string | null;
  /** mock only */ emoji?: string; bg?: string };
export type PhotoPost = { id: string; classId: string; caption: string | null; createdAt: string; author: { id: string; name: string } | null;
  likeCount: number; likedByMe: boolean; photos: PostPhoto[] };

const unwrap = <T,>(r: { items?: T[] } | T[] | null | undefined): T[] => Array.isArray(r) ? r : r?.items ?? [];
export const listPosts = (classId: string, before?: string, limit = 20) =>
  http.get<{ items: PhotoPost[]; nextBefore: string | null }>(`/classes/${classId}/photo-posts?limit=${limit}${before ? "&before=" + encodeURIComponent(before) : ""}`)
    .then(r => ({ items: unwrap(r), nextBefore: r?.nextBefore ?? null }));
/** multipart: files[] (1–20, ≤15MB, JPEG/PNG/WebP/HEIC by magic bytes), caption ≤300, tags = JSON array aligned with files ([["id1"],[],…]).
 *  400 UNSUPPORTED_IMAGE (file name) · 413 FILE_TOO_LARGE · 400 CHILD_NOT_IN_CLASS · 422 PHOTO_CONSENT_MISSING · 403 not own class. */
export const createPost = (classId: string, f: FormData) => http.upload<PhotoPost>(`/classes/${classId}/photo-posts`, f);
/** Authenticated file (use http.blobUrl). download=1 for parents only when the photo tags their own child. */
export const photoFileUrl = (id: string, size: "thumb" | "full" = "thumb", download = false) => `/photos/${id}/file?size=${size}${download ? "&download=1" : ""}`;
export const setPhotoTags = (id: string, childIds: string[]) => http.put<PostPhoto>(`/photos/${id}/tags`, { childIds });
export const unhidePhoto = (id: string) => http.post<PostPhoto>(`/photos/${id}/unhide`, {});
export const likePost = (id: string, on: boolean) => on ? http.post(`/photo-posts/${id}/like`, {}) : http.del(`/photo-posts/${id}/like`);

/** 422 PHOTO_CONSENT_MISSING on POST photo-posts, resolved per photo (index aligned with files/tags).
 *  Feature-detect: per-photo shape (expected next round3 rev; guessed as details.photos=[{index, children}] + optional details.post = the
 *  post created from the other photos) → server already posted the rest. Current contract (details.children only, nothing saved) → we
 *  compute offending photos from our own tags and the caller re-posts the clean ones. */
export type PhotoReject = { index: number; children: { childId: string; name: string }[] };
export function consentRejects(e: unknown, tags: string[][]): { rejects: PhotoReject[]; serverPosted: boolean; post: PhotoPost | null } | null {
  const x = e as { errorCode?: string; details?: { children?: { childId: string; name: string }[]; photos?: { index?: number; fileIndex?: number; children?: { childId: string; name: string }[] }[]; post?: PhotoPost | null } };
  if (x?.errorCode !== "PHOTO_CONSENT_MISSING") return null; const d = x.details ?? {};
  if (Array.isArray(d.photos)) return { serverPosted: true, post: d.post ?? null,
    rejects: d.photos.map(p => ({ index: p.index ?? p.fileIndex ?? -1, children: p.children ?? [] })).filter(p => p.index >= 0) };
  const bad = d.children ?? [];
  return { serverPosted: false, post: null, rejects: tags.map((t, index) => ({ index, children: bad.filter(c => t.includes(c.childId)) })).filter(r => r.children.length) };
}
/** 422 PHOTO_CONSENT_MISSING → [{childId, name}] (else null). */
export function consentMissing(e: unknown): { childId: string; name: string }[] | null {
  const x = e as { errorCode?: string; details?: { children?: { childId: string; name: string }[] } };
  return x?.errorCode === "PHOTO_CONSENT_MISSING" ? x.details?.children ?? [] : null;
}
export const PHOTO_ERR: Record<string, string> = { UNSUPPORTED_IMAGE: "Tệp không phải ảnh hợp lệ (chỉ nhận JPG, PNG, WebP, HEIC)", FILE_TOO_LARGE: "Ảnh quá lớn (tối đa 15MB mỗi ảnh)",
  CHILD_NOT_IN_CLASS: "Có bé không thuộc lớp này" };
export const photoErrorText = (e: unknown) => { const x = e as { errorCode?: string; message?: string; details?: { fileName?: string; file?: string } };
  const t = PHOTO_ERR[x?.errorCode ?? ""]; const f = x?.details?.fileName ?? x?.details?.file; return t ? `${t}${f ? `: ${f}` : ""}` : x?.message ?? "Có lỗi xảy ra" };

let feat: Promise<boolean> | null = null;
export const photosFeature = () => (feat ??= softGet<{ paths?: Record<string, unknown> }>(API_ORIGIN + "/api/docs-json")
  .then(d => Object.keys(d?.paths ?? {}).some(p => /\/classes\/\{[^}]+\}\/photo-posts$/.test(p))));

// ── mock (until the API exists; never sent anywhere) ──
export const MOCK_KIDS = [
  { childId: "m-an", fullName: "Nguyễn Gia An", photoConsent: true }, { childId: "m-ngoc", fullName: "Nguyễn Bảo Ngọc", photoConsent: true },
  { childId: "m-linh", fullName: "Nguyễn Bảo Linh", photoConsent: false }, { childId: "m-chi", fullName: "Nguyễn Gia Chi", photoConsent: false },
];
export const MOCK_POSTS: PhotoPost[] = [{ id: "mock-1", classId: "mock", caption: "Vẽ tranh mùa thu 🍂", createdAt: new Date().toISOString(), author: { id: "m", name: "Cô Lan" }, likeCount: 3, likedByMe: false, photos: [
  { id: "p1", childIds: ["m-an", "m-ngoc"], mine: true, hidden: false, hiddenReason: null, emoji: "🎨", bg: "bg-sun-100" },
  { id: "p2", childIds: ["m-ngoc"], hidden: false, hiddenReason: null, emoji: "🧩", bg: "bg-sky-100" },
  { id: "p3", childIds: ["m-an"], mine: true, hidden: false, hiddenReason: null, emoji: "⚽", bg: "bg-mint-100" },
  { id: "p4", childIds: ["m-chi", "m-an"], hidden: true, hiddenReason: "CONSENT_WITHDRAWN", hiddenForChildIds: ["m-chi"], hiddenAt: new Date(Date.now() - 3600e3).toISOString(), emoji: "🍱", bg: "bg-peach-100" }] }];
