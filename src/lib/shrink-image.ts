/**
 * B32: thu nhỏ ảnh ngay trên điện thoại trước khi upload (cạnh dài ≤ 1600px, JPEG ~0.85) → thường dưới 1 MB,
 * đỡ 4G cho cô giáo, không vướng giới hạn request của proxy, server đỡ tải. Server (B31) vẫn thu nhỏ lần nữa theo từng loại ảnh.
 * - Chỉ đụng tới File ảnh; PDF, Excel… giữ nguyên.
 * - Chứng từ thu chi ("receipt") giữ tới 2048px để đọc rõ chữ nhỏ (khớp B31).
 * - Trình duyệt không giải mã được (vd. HEIC trên Chrome/Android) hoặc có lỗi bất kỳ → gửi nguyên file, server xử lý như cũ.
 * - Ảnh đã nhỏ (≤ cạnh tối đa và ≤ 1 MB) hoặc bản thu nhỏ không nhẹ hơn → giữ nguyên.
 */
const MAX_SIDE = 1600, MAX_SIDE_BY_FIELD: Record<string, number> = { receipt: 2048 }, QUALITY = 0.85, SMALL_ENOUGH = 1024 * 1024;

export async function shrinkImage(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap === "undefined" || !file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  let bmp: ImageBitmap | null = null;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= SMALL_ENOUGH) return file;
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d"); if (!ctx) return file;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // PNG trong suốt → nền trắng thay vì đen khi sang JPEG
    ctx.imageSmoothingQuality = "high"; ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>(ok => canvas.toBlob(ok, "image/jpeg", QUALITY));
    canvas.width = canvas.height = 0; // trả bộ nhớ sớm trên máy yếu
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]*$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
  } catch { return file } finally { bmp?.close() }
}

/** Trả về FormData mới với mọi File ảnh đã thu nhỏ (xử lý tuần tự để máy yếu không hết RAM); giữ nguyên thứ tự và các trường khác. */
export async function shrinkForm(form: FormData): Promise<FormData> {
  const entries = Array.from(form.entries());
  if (!entries.some(([, v]) => typeof v !== "string" && v.type.startsWith("image/"))) return form;
  const out = new FormData();
  for (const [k, v] of entries) out.append(k, typeof v === "string" ? v : await shrinkImage(v as File, MAX_SIDE_BY_FIELD[k] ?? MAX_SIDE));
  return out;
}
