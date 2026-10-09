"use client";
import { useRef, useState } from "react"; import Link from "next/link";
import { http, saveBase64, todayStr } from "@/lib/api"; import { ApiError } from "@/lib/types";
import { appendConfirm, asMismatch, LinkErr, LinkKey, linkKey } from "./link-confirm";

type RowErr = LinkErr;
type Warn = { row: number | null; message: string };
type Guardian = { slot: number; fullName: string; relation: string; phone: string; canPickup: boolean; username: string; account: "create" | "existing" | "existing_inactive" };
type Preview = { row: number; action: "create" | "skip_duplicate"; existingChildId?: string;
  child: { fullName: string; dob: string; gender: "M" | "F"; className: string; classAction: "existing" | "create"; allergies: string | null; healthNotes: string | null; address: string | null; enrolledAt: string ; /** column "Đồng ý chụp ảnh" (Có/Không, default Không) → child.photoConsent (22d15d1) */ photoConsent?: boolean | null; consentPhoto?: boolean | null }; guardians: Guardian[] };
type Summary = { validRows: number; errorRows: number; errorCount: number; childrenToCreate: number; duplicatesToSkip: number; classesToCreate: string[]; parentAccountsToCreate: number; parentAccountsToLink: number; guardiansToCreate: number };
type Report = { dryRun: boolean; createClasses: boolean; maxRows: number; sheet: string; totalRows: number; ok: boolean; summary: Summary; errors: RowErr[]; warnings: Warn[]; preview: Preview[] };
/** Real-import counts. New backend: `summary.{childrenCreated, parentAccountsCreated, parentAccountsLinked, duplicatesSkipped}`; older: `imported` + `skippedDuplicates`. */
type ResultSummary = { childrenCreated?: number; parentAccountsCreated?: number; parentAccountsLinked?: number; duplicatesSkipped?: number };
type Result = { ok: boolean; summary?: ResultSummary; imported?: { children: number; guardians: number; parentAccountsCreated: number; parentAccountsLinked: number; classesCreated: string[] };
  skippedDuplicates?: { row: number; fullName: string; existingChildId: string }[]; warnings: Warn[]; resultFile?: { fileName: string; mimeType: string; base64: string } };

const MAX = 5 * 1024 * 1024;
const ACCOUNT: Record<string, [string, string]> = { create: ["Tạo tài khoản mới", "bg-mint-100 text-mint-700"], existing: ["Gắn vào tài khoản có sẵn", "bg-sky-100 text-sky-500"], existing_inactive: ["Tài khoản đang bị khóa", "bg-rose-100 text-rose-500"] };
const ERR_CODE: Record<string, string> = { INVALID_FILE: "File không phải Excel .xlsx hợp lệ.", TEMPLATE_MISMATCH: "File không đúng mẫu. Hãy tải file mẫu và nhập dữ liệu vào đó.",
  EMPTY_FILE: "File chưa có dữ liệu (dữ liệu bắt đầu từ dòng 2).", TOO_MANY_ROWS: "File quá nhiều dòng (tối đa 1000 dòng mỗi lần)." };
const counts = (r: Result) => ({
  kids: r.summary?.childrenCreated ?? r.imported?.children ?? 0, created: r.summary?.parentAccountsCreated ?? r.imported?.parentAccountsCreated ?? 0,
  linked: r.summary?.parentAccountsLinked ?? r.imported?.parentAccountsLinked ?? 0, skipped: r.summary?.duplicatesSkipped ?? r.skippedDuplicates?.length ?? 0 });
const vnDate = (d?: string | null) => d ? d.slice(0, 10).split("-").reverse().join("/") : "";

export default function ImportPage() {
  const inp = useRef<HTMLInputElement>(null); const [file, setFile] = useState<File | null>(null); const [createClasses, setCreateClasses] = useState(false);
  const [rep, setRep] = useState<Report | null>(null); const [res, setRes] = useState<Result | null>(null); const [busy, setBusy] = useState<"" | "check" | "import" | "tpl">("");
  const [err, setErr] = useState<string[]>([]); const [confirm, setConfirm] = useState(false); const [savedName, setSavedName] = useState("");
  const [links, setLinks] = useState<Map<string, LinkKey>>(new Map()); const [linksDirty, setLinksDirty] = useState(false);
  const toggleLink = (l: LinkKey, on: boolean) => { setLinks(m => { const n = new Map(m); if (on) n.set(linkKey(l.row, l.guardian), l); else n.delete(linkKey(l.row, l.guardian)); return n }); setLinksDirty(true) };

  function pick(f: File | null) { setRep(null); setRes(null); setErr([]); setConfirm(false); setLinks(new Map()); setLinksDirty(false);
    if (!f) { setFile(null); return }
    if (!/\.xlsx$/i.test(f.name)) { setFile(null); setErr(["Chỉ nhận file Excel .xlsx (không nhận .xls, .csv)."]); return }
    if (f.size > MAX) { setFile(null); setErr([`File ${(f.size / 1048576).toFixed(1)}MB, vượt giới hạn 5MB.`]); return }
    setFile(f) }
  const form = () => { const fd = new FormData(); fd.append("file", file!); return appendConfirm(fd, Array.from(links.values())) };
  const q = (dry: boolean) => `/imports/children?dryRun=${dry}&createClasses=${createClasses}`;
  function explain(e: unknown): string[] { const x = e as ApiError; const det = (x.details ?? {}) as { missingColumns?: string[] };
    if (x.code === 413) return ["File vượt giới hạn 5MB."];
    const base = (x.errorCode && ERR_CODE[x.errorCode]) || x.message || "Có lỗi xảy ra, vui lòng thử lại";
    return det.missingColumns?.length ? [base, `Thiếu cột: ${det.missingColumns.join(", ")}`] : [base] }

  async function check() { if (!file) return; setBusy("check"); setErr([]); setRep(null); setRes(null); setLinksDirty(false);
    try { setRep(await http.upload<Report>(q(true), form())) } catch (e) { setErr(explain(e)) } finally { setBusy("") } }
  async function doImport() { if (!file) return; setConfirm(false); setBusy("import"); setErr([]);
    try { const r = await http.upload<Result>(q(false), form()); setRes(r); setRep(null);
      if (r.resultFile?.base64) { const name = `mat-khau-tam-phu-huynh-${todayStr().replace(/-/g, "")}.xlsx`; saveBase64(r.resultFile.base64, name, r.resultFile.mimeType || undefined); setSavedName(name) } }
    catch (e) { const x = e as ApiError;
      // 422 IMPORT_INVALID: details = báo cáo như dry run (dữ liệu đổi giữa lúc kiểm tra và lúc nhập)
      if (x.code === 422 && x.details && typeof x.details === "object" && "errors" in (x.details as object)) { setRep(x.details as Report); setErr(["Chưa nhập gì: dữ liệu có lỗi (có thể đã thay đổi sau khi kiểm tra). Xem danh sách lỗi bên dưới."]) }
      else setErr(explain(e)) }
    finally { setBusy("") } }
  async function template() { setBusy("tpl"); setErr([]); try { await http.download("/imports/children/template", "mau-nhap-hoc-sinh.xlsx") } catch (e) { setErr(explain(e)) } finally { setBusy("") } }

  // nhóm lỗi theo dòng Excel
  const groups = new Map<string, RowErr[]>(); for (const e of rep?.errors ?? []) { const k = e.row == null ? "Chung" : String(e.row); groups.set(k, [...(groups.get(k) ?? []), e]) }
  const s = rep?.summary; const canImport = !!rep && rep.ok && rep.errors.length === 0 && (s?.childrenToCreate ?? 0) > 0 && !linksDirty;

  return <div className="mx-auto max-w-5xl space-y-4">
    <h1 className="text-2xl font-bold">Nhập học sinh từ Excel</h1>
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-500 font-bold text-white">1</span><b>Tải file mẫu, điền dữ liệu</b>
        <button className="btn ml-auto !bg-white !text-mint-700 ring-1 ring-mint-300" onClick={template} disabled={busy === "tpl"} data-testid="btn-template">⬇ Tải file mẫu (.xlsx)</button></div>
      <p className="text-sm text-ink-500">Sheet “Học sinh”, mỗi dòng một bé, tối đa 1000 dòng. Cột có dấu * là bắt buộc. Ngày sinh dạng dd/mm/yyyy. Cột “Đồng ý chụp ảnh”: Có / Không (để trống = Không). Phụ huynh được nhận diện theo số điện thoại: SĐT đã có tài khoản thì gắn bé vào, chưa có thì tạo tài khoản mới (tên đăng nhập = SĐT).</p>
    </div>
    <div className="card space-y-3">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-500 font-bold text-white">2</span><b>Chọn file và kiểm tra</b></div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={inp} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={e => pick(e.target.files?.[0] ?? null)} data-testid="import-file" />
        <button className="btn !bg-white !text-ink-700 ring-1 ring-ink-100" onClick={() => inp.current?.click()} data-testid="btn-choose-file">📄 {file ? "Chọn file khác" : "Chọn file .xlsx"}</button>
        {file && <span className="text-sm" data-testid="import-file-name">{file.name} · {(file.size / 1024).toFixed(0)} KB</span>}
        <label className="flex min-h-12 items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5" checked={createClasses} onChange={e => { setCreateClasses(e.target.checked); setRep(null) }} data-testid="import-create-classes" />Tự tạo lớp mới nếu chưa có</label>
        <button className="btn ml-auto" disabled={!file || !!busy} onClick={check} data-testid="btn-import-check">{busy === "check" ? "Đang kiểm tra…" : "🔍 Kiểm tra"}</button></div>
      {err.length > 0 && <div className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-500" role="alert" data-testid="import-error">{err.map((m, i) => <p key={i}>{m}</p>)}</div>}
    </div>

    {rep && s && <div className="card space-y-4" data-testid="import-report">
      <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-500 font-bold text-white">3</span><b>Kết quả kiểm tra</b>
        <span className={`ml-auto rounded-full px-3 py-1 text-sm font-semibold ${rep.errors.length ? "bg-rose-100 text-rose-500" : "bg-mint-100 text-mint-700"}`} data-testid="import-status">{rep.errors.length ? `${s.errorCount} lỗi ở ${s.errorRows} dòng` : "✔ Không có lỗi"}</span></div>
      <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4" data-testid="import-summary">
        {[["Tổng số dòng", rep.totalRows], ["Bé sẽ được thêm", s.childrenToCreate], ["Bé đã có (bỏ qua)", s.duplicatesToSkip], ["Dòng lỗi", s.errorRows],
          ["Tài khoản PH mới", s.parentAccountsToCreate], ["Gắn vào TK có sẵn", s.parentAccountsToLink], ["Người giám hộ mới", s.guardiansToCreate], ["Lớp sẽ tạo", s.classesToCreate.length]].map(([l, v]) =>
          <div key={String(l)} className="rounded-2xl bg-ink-100/50 p-3"><div className="text-xs text-ink-500">{l}</div><b className="text-xl">{v}</b></div>)}</div>
      {s.classesToCreate.length > 0 && <p className="text-sm">Lớp mới sẽ được tạo: <b>{s.classesToCreate.join(", ")}</b></p>}

      {rep.errors.length > 0 && <div className="space-y-2" data-testid="import-errors"><h3 className="font-semibold text-rose-500">Lỗi cần sửa trong file (sửa xong chọn lại file và bấm Kiểm tra)</h3>
        {Array.from(groups.entries()).map(([row, es]) => <div key={row} className="rounded-2xl border-l-4 border-rose-500 bg-rose-100/50 p-3 text-sm" data-testid="import-error-row">
          <b>{row === "Chung" ? "Lỗi chung" : `Dòng ${row}`}</b>
          <ul className="mt-1 list-disc pl-5">{es.map((e, i) => { const mm = asMismatch(e); const on = !!mm && links.has(linkKey(mm.row, mm.guardian));
            return <li key={i}>{e.column && <span className="font-semibold">Cột “{e.column}”: </span>}{e.message.replace(/\s*\(confirmLinks\)/g, "")}{e.value != null && e.value !== "" && <span className="text-ink-500"> (giá trị: “{String(e.value)}”)</span>}{e.conflictRow ? <span className="ml-1 rounded-full bg-rose-500 px-2 text-xs text-white" data-testid="import-conflict-row">trùng với dòng {e.conflictRow}</span> : null}
              {mm && <LinkBox l={mm} on={on} onChange={v => toggleLink(mm, v)} />}</li> })}</ul></div>)}</div>}
      {links.size > 0 && <div className="space-y-2 rounded-2xl border-2 border-rose-500 p-3 text-sm" data-testid="import-confirmed-links"><b className="text-rose-500">Đã xác nhận gắn vào tài khoản có sẵn ({links.size})</b>
        {Array.from(links.values()).map(l => <div key={linkKey(l.row, l.guardian)}><b>Dòng {l.row}</b> · phụ huynh {l.guardian}{l.phone ? ` · ${l.phone}` : ""}<LinkBox l={l} on onChange={v => toggleLink(l, v)} /></div>)}</div>}
      {linksDirty && <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-100 p-3 text-sm" data-testid="import-links-dirty">Bạn vừa thay đổi xác nhận gắn tài khoản. Kiểm tra lại để cập nhật kết quả trước khi nhập.
        <button className="btn ml-auto" disabled={!!busy} onClick={check} data-testid="btn-import-recheck">{busy === "check" ? "Đang kiểm tra…" : "🔍 Kiểm tra lại"}</button></div>}

      {rep.warnings.length > 0 && <div className="rounded-2xl bg-sun-100 p-3 text-sm" data-testid="import-warnings"><b>Lưu ý ({rep.warnings.length})</b>
        <ul className="mt-1 list-disc pl-5">{rep.warnings.map((w, i) => <li key={i}>{w.row != null && <b>Dòng {w.row}: </b>}{w.message}</li>)}</ul></div>}

      {rep.preview.length > 0 && <div><h3 className="mb-2 font-semibold">Xem trước ({rep.preview.length} dòng hợp lệ)</h3>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm [&_td]:px-2 [&_td]:py-2 [&_th]:px-2" data-testid="import-preview"><thead className="text-left text-ink-500"><tr><th>Dòng</th><th>Bé</th><th>Ngày sinh</th><th>Lớp</th><th>Phụ huynh</th><th>Thao tác</th></tr></thead>
          <tbody>{rep.preview.map(p => <tr key={p.row} className={`border-t border-ink-100 align-top ${p.action === "skip_duplicate" ? "text-ink-500" : ""}`}>
            <td>{p.row}</td><td><b>{p.child.fullName}</b> <span className="text-ink-500">({p.child.gender === "F" ? "Nữ" : "Nam"})</span>{p.child.allergies && <div className="text-xs text-rose-500">⚠ Dị ứng: {p.child.allergies}</div>}{(p.child.photoConsent ?? p.child.consentPhoto) != null && <div className="text-xs" data-testid="import-consent">{(p.child.photoConsent ?? p.child.consentPhoto) ? "📷 Đồng ý đăng ảnh" : "🚫 Không đăng ảnh"}</div>}</td>
            <td>{vnDate(p.child.dob)}</td><td>{p.child.className}{p.child.classAction === "create" && <span className="ml-1 rounded-full bg-peach-100 px-2 text-xs text-peach-600">lớp mới</span>}</td>
            <td>{p.guardians.map(g => <div key={g.slot}>{g.fullName} <span className="text-ink-500">({g.relation}) · {g.phone}{!g.canPickup && " · không được đón"}</span> {p.action === "create" && <span className={`rounded-full px-2 text-xs ${ACCOUNT[g.account]?.[1] ?? ""}`}>{ACCOUNT[g.account]?.[0] ?? g.account}</span>}</div>)}</td>
            <td>{p.action === "create" ? <span className="text-mint-700">Thêm mới</span> : <span>Đã có, bỏ qua</span>}</td></tr>)}</tbody></table></div></div>}

      <div className="flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
        <button className="btn !bg-peach-500 disabled:!bg-ink-100" disabled={!canImport || !!busy} onClick={() => setConfirm(true)} data-testid="btn-import-run">{busy === "import" ? "Đang nhập… (có thể mất đến 1 phút)" : `⬆ Nhập thật ${s.childrenToCreate} bé`}</button>
        {!canImport && <span className="text-sm text-ink-500">{rep.errors.length ? "Sửa hết lỗi rồi kiểm tra lại để nhập." : "Không có bé mới để nhập."}</span>}</div>
    </div>}

    {confirm && s && <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-900/40 p-4 md:items-center" role="dialog" aria-modal="true" data-testid="import-confirm">
      <div className="card w-full max-w-md space-y-3"><h2 className="text-lg font-bold">Xác nhận nhập dữ liệu</h2>
        <p className="text-sm">Thêm <b>{s.childrenToCreate}</b> bé, tạo <b>{s.parentAccountsToCreate}</b> tài khoản phụ huynh mới{s.classesToCreate.length ? <>, tạo lớp <b>{s.classesToCreate.join(", ")}</b></> : null}. Thao tác này không hoàn tác tự động được.</p>
        {links.size > 0 && <p className="rounded-2xl bg-rose-100 p-3 text-sm text-rose-500" data-testid="import-confirm-links">⚠ Gắn bé vào <b>{links.size}</b> tài khoản có sẵn khác tên mà bạn đã xác nhận: {Array.from(links.values()).map(l => `${l.name} (dòng ${l.row})`).join(", ")}.</p>}
        <p className="rounded-2xl bg-sun-100 p-3 text-sm">Sau khi nhập, trình duyệt sẽ tải về file mật khẩu tạm của phụ huynh. <b>Đây là lần duy nhất có mật khẩu này</b>, hãy lưu file cẩn thận.</p>
        <div className="flex gap-2"><button className="btn flex-1 !bg-peach-500 disabled:!bg-ink-100" onClick={doImport} data-testid="btn-import-confirm">Nhập ngay</button><button className="btn flex-1 !bg-ink-300" onClick={() => setConfirm(false)}>Hủy</button></div></div></div>}

    {res && <div className="card space-y-3 bg-mint-50" data-testid="import-result">
      <h2 className="text-lg font-bold text-mint-700">✔ Đã nhập xong</h2>
      {(() => { const c = counts(res); return <p data-testid="import-result-counts">Đã nhập <b>{c.kids}</b> bé, tạo <b>{c.created}</b> tài khoản mới, gắn <b>{c.linked}</b> tài khoản có sẵn, bỏ qua <b>{c.skipped}</b> bé trùng{res.imported?.classesCreated.length ? `; tạo lớp ${res.imported.classesCreated.join(", ")}` : ""}.</p> })()}
      {res.resultFile?.base64 && <div className="rounded-2xl border-2 border-rose-500 bg-rose-100 p-4" data-testid="import-password-warning">
        <p className="text-lg font-bold text-rose-500">⚠ Lưu ngay file mật khẩu tạm</p>
        <p className="text-sm">File <b>{savedName}</b> đã được tải về máy. File gồm 4 sheet; mật khẩu tạm nằm ở sheet <b>“Mật khẩu tạm (in phát)”</b> để in và phát cho phụ huynh. Mật khẩu tạm <b>chỉ có trong file này, không lưu trên hệ thống và không thể xem lại</b>. Nếu mất file, phải đặt lại mật khẩu từng tài khoản ở trang Tài khoản. Phụ huynh sẽ được yêu cầu đổi mật khẩu ở lần đăng nhập đầu.</p>
        <button className="btn mt-2 !bg-rose-500 disabled:!bg-ink-100" onClick={() => saveBase64(res.resultFile!.base64, savedName, res.resultFile!.mimeType || undefined)} data-testid="btn-download-passwords">⬇ Tải lại file mật khẩu</button>
        <p className="mt-1 text-xs text-ink-500">Nút tải lại chỉ dùng được khi chưa rời trang này.</p></div>}
      {res.warnings.length > 0 && <ul className="list-disc pl-5 text-sm">{res.warnings.map((w, i) => <li key={i}>{w.row != null && <b>Dòng {w.row}: </b>}{w.message}</li>)}</ul>}
      <div className="flex gap-2"><Link href="/children" className="btn">Xem hồ sơ trẻ</Link><button className="btn !bg-white !text-ink-700" onClick={() => { setRes(null); pick(null); if (inp.current) inp.current.value = "" }}>Nhập file khác</button></div></div>}
  </div>;
}

/** Per-row confirmation for "phone already belongs to an account with another name". Default unchecked. */
function LinkBox({ l, on, onChange }: { l: LinkKey; on: boolean; onChange: (v: boolean) => void }) {
  return <div className="mt-2 rounded-xl bg-white p-2" data-testid="import-link-confirm" data-row={l.row}>
    <label className="flex min-h-12 items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6 accent-rose-500" checked={on} onChange={e => onChange(e.target.checked)} data-testid="import-link-checkbox" />
      {l.conflictRow ? <>Xác nhận dùng chung một tài khoản với <span className="text-rose-500">dòng {l.conflictRow}</span></> : <>Xác nhận gắn vào tài khoản <span className="text-rose-500">{l.name}</span></>}</label>
    <p className="text-xs text-rose-500">⚠ Người dùng tài khoản này{l.phone ? ` (${l.phone})` : ""}{l.childrenCount ? `, đang có ${l.childrenCount} bé,` : ""} sẽ xem được toàn bộ thông tin của bé: điểm danh, nhật ký, sức khỏe, học phí, ảnh. Chỉ tích khi chắc chắn đây là cùng một người.</p></div>;
}
