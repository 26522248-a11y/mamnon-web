"use client";
/**
 * Parent: VietQR transfer card on an open invoice (mockups7 #3/#4, round3-api §1). States:
 *  - not live → "Sắp có" · /settings/school.bankTransfer.enabled=false or 409 BANK_ACCOUNT_NOT_CONFIGURED → ink-100 card + school phone (no empty QR frame)
 *  - QR rendered client-side from `payload` (+ "Dữ liệu mẫu – không chuyển khoản" when sample) · "Tôi đã chuyển" → claim (never marks paid)
 *  - pending (invoice.paymentStatus / qr.pendingClaim) → sun-100 row "⏳ Đã báo chuyển lúc HH:MM · Kế toán đang kiểm tra" + "Chuyển nhầm? Liên hệ trường"
 *  - rejected → rose banner with the accountant's reason, QR + button again · confirmed → mint card + receipt link
 */
import { useCallback, useEffect, useRef, useState } from "react"; import Link from "next/link";
import { vnd, vnTime } from "@/lib/fmt"; import { fmtDateTime } from "@/lib/date"; import { QrCode } from "@/components/QrCode";
import { bankName, claimTransfer, FeeFeatures, feeFeatures, feesErrorText, getInvoiceQr, InvoiceQr, schoolBank, SchoolBank, TransferClaim } from "@/lib/fees-api";
import { Invoice } from "./types";

function Copy({ text, label, testid }: { text: string; label: string; testid: string }) {
  const [ok, setOk] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(text) } catch { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove() }
    setOk(true); setTimeout(() => setOk(false), 1500) };
  return <button type="button" onClick={copy} aria-label={`Sao chép ${label}`} data-testid={testid}
    className={`min-h-12 shrink-0 rounded-xl px-3 text-sm font-semibold ${ok ? "bg-mint-100 text-mint-700" : "bg-ink-100 text-ink-700"}`}>{ok ? "✓ Đã chép" : "📋 Chép"}</button>;
}
function Field({ label, value, copy, testid, mono }: { label: string; value: string; copy?: string; testid: string; mono?: boolean }) {
  return <div className="flex min-h-12 items-center justify-between gap-2 border-t border-ink-100 py-1">
    <div className="min-w-0"><div className="text-xs text-ink-500">{label}</div><div className={`break-all font-semibold ${mono ? "font-mono" : ""}`} data-testid={`${testid}-value`}>{value}</div></div>
    {copy !== undefined && <Copy text={copy} label={label} testid={`${testid}-copy`} />}</div>;
}
const PhoneLink = ({ phone, children }: { phone: string | null; children: React.ReactNode }) =>
  phone ? <a href={`tel:${phone.replace(/\s/g, "")}`} className="font-semibold text-mint-700 underline" data-testid="school-phone">{children}</a> : <>{children}</>;
function NoBank({ phone }: { phone: string | null }) {
  return <div className="rounded-2xl bg-ink-100 p-4 text-ink-700" data-testid="qr-no-bank"><b className="block">Trường chưa mở thanh toán chuyển khoản, vui lòng đóng tại văn phòng.</b>
    {phone && <p className="mt-1 text-sm">Vui lòng liên hệ nhà trường: <PhoneLink phone={phone}>{phone}</PhoneLink></p>}</div>;
}

export function QrPay({ inv, onChange }: { inv: Invoice; onChange?: () => void }) {
  const [ft, setFt] = useState<FeeFeatures | null>(null); const [sb, setSb] = useState<SchoolBank | null>(null);
  const [qr, setQr] = useState<InvoiceQr | null>(null); const [qrErr, setQrErr] = useState<{ code?: string; text: string; phone?: string } | null>(null);
  const [claim, setClaim] = useState<TransferClaim | null>(inv.transferClaim ?? null); const [png, setPng] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const inflight = useRef(false);
  useEffect(() => { feeFeatures().then(setFt); schoolBank().then(setSb) }, []);
  useEffect(() => { setClaim(inv.transferClaim ?? null) }, [inv.transferClaim]);
  const enabled = sb?.bankTransfer ? sb.bankTransfer.enabled : true; // field missing (older backend) → ask the QR endpoint
  const load = useCallback(() => { if (!ft?.qr || !enabled || inv.balance <= 0) return;
    getInvoiceQr(inv.id).then(q => { setQr(q); setQrErr(null); if (q.pendingClaim) setClaim(q.pendingClaim) })
      .catch(e => { const x = e as { errorCode?: string; details?: { schoolPhone?: string } }; setQr(null); setQrErr({ code: x.errorCode, text: feesErrorText(e), phone: x.details?.schoolPhone }) }) }, [ft, enabled, inv.id, inv.balance]);
  useEffect(() => { load() }, [load]);
  const onPng = useCallback((p: string | null) => setPng(p), []);
  if (!ft || !sb) return null;
  const phone = qrErr?.phone ?? sb.phone;
  if (!ft.qr) return <div className="card space-y-1 text-center" data-testid="qr-soon"><div className="text-2xl">🚧</div><b>Thanh toán chuyển khoản bằng mã QR: sắp có</b>
    <p className="text-sm text-ink-500">Trong lúc chờ, bố mẹ vui lòng đóng tại văn phòng{phone ? <> hoặc gọi <PhoneLink phone={phone}>{phone}</PhoneLink></> : ""}.</p></div>;
  const pending = claim?.status === "pending_confirmation" || inv.paymentStatus === "pending_confirmation" ? claim : null;
  const isPending = !!pending || inv.paymentStatus === "pending_confirmation";
  if (isPending) return <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 rounded-2xl bg-sun-100 p-4 text-ink-900" data-testid="qr-pending">
    <span>⏳ Đã báo chuyển{pending ? ` ${vnd(pending.amount)} lúc ${vnTime(pending.claimedAt)}` : ""} · Kế toán đang kiểm tra</span>
    <span className="text-sm">Chuyển nhầm? <PhoneLink phone={phone}>Liên hệ trường</PhoneLink></span></div>;
  const confirmed = claim?.status === "confirmed" ? claim : null; const rejected = claim?.status === "rejected" ? claim : null;
  const greenCard = confirmed && <div className="card space-y-1 bg-mint-50 text-center" data-testid="qr-confirmed"><div className="text-3xl">✅</div><b className="text-mint-700">Đã nhận tiền</b>
    <p className="text-sm">Kế toán xác nhận {confirmed.decidedAt ? fmtDateTime(confirmed.decidedAt) : ""}{confirmed.receiptNo ? ` · Biên lai ${confirmed.receiptNo}` : ""}</p>
    {confirmed.paymentId && <Link href={`/fees/receipt/${confirmed.paymentId}`} className="inline-flex min-h-12 items-center font-semibold text-mint-700 underline">Xem biên lai →</Link>}</div>;
  if (inv.balance <= 0) return greenCard || null;
  if (!enabled || qrErr?.code === "BANK_ACCOUNT_NOT_CONFIGURED") return <>{greenCard}<NoBank phone={phone} /></>;
  if (qrErr) return <p className="rounded-2xl bg-ink-100 p-4 text-sm" data-testid="qr-error">{qrErr.text}</p>;
  if (!qr) return <p className="text-sm text-ink-500">Đang tạo mã QR…</p>;
  const sample = qr.sample || !!sb.bankTransfer?.sample;
  const doClaim = async () => { if (inflight.current) return;
    if (!confirm((sample ? "⚠ Dữ liệu mẫu – đây là báo chuyển thử, không có tiền thật.\n\n" : "") + `Bố mẹ đã chuyển ${vnd(qr.amount)} với nội dung “${qr.transferContent}”? Kế toán sẽ đối chiếu rồi gửi biên lai.`)) return;
    inflight.current = true; setBusy(true); setErr("");
    try { setClaim(await claimTransfer(inv.id, { amount: qr.amount })); onChange?.() } catch (e) { setErr(feesErrorText(e)) } finally { inflight.current = false; setBusy(false) } };
  return <div className="space-y-3" data-testid="qr-card">
    {greenCard}
    {rejected && <div className="rounded-2xl bg-rose-100 p-4 text-rose-600" data-testid="qr-rejected"><b className="block">Chưa nhận được khoản chuyển</b>
      {rejected.rejectReason && <p className="text-sm">Kế toán: “{rejected.rejectReason}”</p>}<p className="mt-1 text-xs text-ink-700">Bố mẹ kiểm tra lại rồi chuyển theo mã bên dưới, hoặc liên hệ trường.</p></div>}
    <div className="card space-y-2">
      {sample && <div className="rounded-2xl border-2 border-dashed border-rose-500 bg-rose-100 p-2 text-center font-bold text-rose-600" data-testid="qr-sample">⚠ Dữ liệu mẫu – không chuyển khoản</div>}
      <div className="relative mx-auto h-56 w-56"><QrCode payload={qr.payload} alt={`Mã VietQR ${qr.invoiceNo}`} className="h-56 w-56" onPng={onPng} />
        {sample && <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="-rotate-12 rounded bg-white/85 px-2 py-1 text-lg font-black text-rose-600">MẪU – KHÔNG CHUYỂN</span></div>}</div>
      <p className="text-center text-sm text-ink-500">Mở app ngân hàng, quét mã VietQR</p>
      <Field label="Ngân hàng" value={bankName(qr.bank.bin)} testid="qr-bank" />
      <Field label="Số tài khoản" value={qr.bank.accountNo} copy={qr.bank.accountNo} testid="qr-account" mono />
      <Field label="Chủ tài khoản" value={qr.bank.accountName} testid="qr-holder" />
      <Field label="Số tiền" value={vnd(qr.amount)} copy={String(qr.amount)} testid="qr-amount" />
      <Field label="Nội dung chuyển khoản" value={qr.transferContent} copy={qr.transferContent} testid="qr-content" mono />
      <p className="text-xs text-ink-500">Giữ nguyên nội dung để kế toán đối soát. Chuyển sai số tiền hoặc thiếu nội dung, kế toán sẽ liên hệ lại.</p></div>
    {err && <p className="text-sm text-rose-600" role="alert">{err}</p>}
    <div className="grid grid-cols-2 gap-2">
      {png && !sample ? <a href={png} download={`QR-${qr.invoiceNo}.png`} className="flex min-h-12 items-center justify-center rounded-2xl border-2 border-mint-500 font-semibold text-mint-700" data-testid="qr-save">⬇ Lưu mã QR</a> : <span />}
      <button type="button" className="min-h-12 rounded-2xl bg-mint-500 font-semibold text-white disabled:bg-ink-100 disabled:text-ink-500" disabled={busy}
        title={sample ? "Dữ liệu mẫu – báo chuyển thử" : undefined} onClick={doClaim} data-testid="qr-claim">{busy ? "Đang gửi…" : "Tôi đã chuyển"}</button></div></div>;
}
