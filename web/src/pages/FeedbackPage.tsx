import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Feedback } from "../api/types";
import { Modal } from "../components/Modal";
import { formatDateTime } from "../lib/format";

const API_BASE = import.meta.env.VITE_API_URL || "";

const ROLE_LABEL: Record<string, string> = {
  tenant: "Khách thuê",
  manager: "Người quản lý",
  admin: "Quản trị",
};

export function FeedbackPage() {
  const [rows, setRows] = useState<Feedback[]>([]);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    api<Feedback[]>("/api/feedback")
      .then(setRows)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function markDone(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/feedback/${id}/done`, { method: "POST" });
      load();
      if (selected?.id === id) {
        setSelected((s) => (s ? { ...s, status: "done" } : s));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  async function markReopen(id: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/feedback/${id}/reopen`, { method: "POST" });
      load();
      if (selected?.id === id) {
        setSelected((s) => (s ? { ...s, status: "new" } : s));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[var(--text)]">Góp ý</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Tiếp nhận góp ý từ khách thuê và người quản lý
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={load}>
          Làm mới
        </button>
      </div>

      {error ? <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div> : null}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--muted)] border-b border-[var(--border)]">
              <th className="px-4 py-3 font-medium">Thời gian</th>
              <th className="px-4 py-3 font-medium">Người gửi</th>
              <th className="px-4 py-3 font-medium">Vai trò</th>
              <th className="px-4 py-3 font-medium">Tiêu đề</th>
              <th className="px-4 py-3 font-medium">Trạng thái</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--muted)]">
                  Chưa có góp ý nào
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.user_name}</div>
                    <div className="text-xs text-[var(--muted)]">{row.user_email}</div>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABEL[row.user_role || ""] || row.user_role}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{row.title}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex text-xs font-semibold px-2 py-1 rounded-full ${
                        row.status === "done"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {row.status === "done" ? "Đã xử lý" : "Mới"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button type="button" className="btn-secondary" onClick={() => setSelected(row)}>
                        Xem
                      </button>
                      {row.status === "done" ? (
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={busy}
                          onClick={() => markReopen(row.id)}
                        >
                          Chưa xử lý
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={busy}
                          onClick={() => markDone(row.id)}
                        >
                          Đã xử lý
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} panelClassName="max-w-2xl">
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{selected.title}</h2>
                <p className="text-sm text-[var(--muted)] mt-1">
                  {selected.user_name} · {ROLE_LABEL[selected.user_role || ""] || selected.user_role} ·{" "}
                  {formatDateTime(selected.created_at)}
                </p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => setSelected(null)}>
                Đóng
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed border border-[var(--border)] rounded-lg p-4 bg-[var(--surface-soft)]">
              {selected.content}
            </div>
            {selected.images?.length ? (
              <div>
                <div className="text-sm font-medium mb-2">Ảnh đính kèm ({selected.images.length})</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {selected.images.map((img) => (
                    <a
                      key={img.id}
                      href={`${API_BASE}${img.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg overflow-hidden border border-[var(--border)]"
                    >
                      <img
                        src={`${API_BASE}${img.url}`}
                        alt=""
                        className="w-full h-32 object-cover bg-[var(--surface-soft)]"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">Không có ảnh đính kèm</p>
            )}
            {selected.status === "done" ? (
              <button type="button" className="btn-secondary" disabled={busy} onClick={() => markReopen(selected.id)}>
                Đánh dấu chưa xử lý
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={busy} onClick={() => markDone(selected.id)}>
                Đánh dấu đã xử lý
              </button>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
