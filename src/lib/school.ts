"use client";
import { useEffect, useState } from "react"; import { softGet } from "./api";
export type School = { name: string | null; address: string | null; phone: string | null };
let cache: Promise<School | null> | null = null;
/** GET /settings/school (tên, địa chỉ, SĐT trường). 404 hoặc lỗi → null, giao diện tự dùng chữ trung tính. */
export function getSchool(): Promise<School | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const s = sessionStorage.getItem("school"); if (s) return Promise.resolve(JSON.parse(s));
  cache ??= softGet<School & { school?: School }>("/settings/school").then(r => { const v = r ? (r.school ?? r) : null; if (v?.name) { sessionStorage.setItem("school", JSON.stringify(v)); localStorage.setItem("schoolName", v.name) } else cache = null; return v });
  return cache;
}
export function useSchool() { const [s, setS] = useState<School | null>(null); useEffect(() => { getSchool().then(setS) }, []); return s }
export const APP_NAME = "Quản lý mầm non";
