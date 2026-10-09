/* Service worker: Web Push for pickup safety (đợt 1). No offline cache yet.
 * Registered as /sw.js?api=<API origin> (see src/lib/pickup-api.ts SW_URL) so relative photo URLs in payloads can be resolved.
 * Payload (backend notifications/channels.ts WebPushChannel):
 *   { title, body, tag, image?, icon, badge, requireInteraction, actions:[{action:'confirm'|'reject', title}],
 *     data:{ type, url, pickupRequestId?, childId?, expiresAt?, actionToken?, actionUrl?, photoUrl? } }
 */
const API = new URL(self.location.href).searchParams.get("api") || self.location.origin;
const abs = (u) => (!u ? undefined : /^https?:/.test(u) ? u : API + u);

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Thông báo", body: e.data ? e.data.text() : "" }; }
  const data = Object.assign({ url: "/notifications" }, d.data || {});
  const isReq = data.type === "pickup_request" && data.pickupRequestId;
  const opts = {
    body: d.body || "", icon: d.icon || "/icon-192.png", badge: d.badge || "/icon-192.png", tag: d.tag, renotify: !!d.tag,
    image: abs(d.image || data.photoUrl), requireInteraction: isReq || !!d.requireInteraction, vibrate: isReq ? [300, 100, 300, 100, 300] : undefined,
    // Only pickup requests carry Confirm / Reject; both open the app so the parent sees the photo before the final tap.
    actions: isReq ? (d.actions && d.actions.length ? d.actions : [{ action: "confirm", title: "Xác nhận" }, { action: "reject", title: "Từ chối" }]) : [],
    data,
  };
  e.waitUntil(self.registration.showNotification(d.title || "Thông báo", opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  let url = data.url || "/notifications";
  if (data.type === "pickup_request" && data.pickupRequestId) {
    const action = e.action === "confirm" || e.action === "reject" ? e.action : "";
    url = `/today?req=${encodeURIComponent(data.pickupRequestId)}${action ? "&action=" + action : ""}`;
  }
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ("focus" in c) { return c.focus().then((w) => (w && "navigate" in w ? w.navigate(url) : self.clients.openWindow(url))); }
    return self.clients.openWindow(url);
  }));
});

// Browser rotated / revoked the subscription: re-subscribe on next app open (PushOptIn shows again). TODO(pickup-api): resubscribe here once the backend accepts an unauthenticated refresh.
self.addEventListener("pushsubscriptionchange", () => {});
