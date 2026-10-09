"use client";
import { useRouter } from "next/navigation"; import Link from "next/link";
import LeaveForm from "@/components/LeaveForm";
export default function NewLeave() {
  const r = useRouter();
  return <div className="mx-auto max-w-md space-y-3"><Link href="/home" className="text-sm text-mint-700">‹ Trang đầu</Link>
    <LeaveForm onDone={l => r.replace(`/staff/leaves/${l.id}?sent=1`)} onCancel={() => r.back()} /></div>;
}
