import { useEffect, useRef, useState } from "react";

const CONTACTS = [
  {
    id: "zalo",
    label: "Zalo",
    href: import.meta.env.VITE_CONTACT_ZALO || "https://zalo.me/harborstay",
    bg: "#0068ff",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        <path d="M12.04 2C6.58 2 2.15 6.14 2.15 11.24c0 2.9 1.4 5.49 3.58 7.24V22l3.32-1.82c.94.26 1.94.4 2.99.4 5.46 0 9.89-4.14 9.89-9.24S17.5 2 12.04 2zm.96 13.95h-.01l-2.52-2.7-2.7 2.7H6.2l3.55-3.58L6.35 8.8h1.57l2.38 2.48 2.48-2.48h1.57l-3.4 3.57 3.55 3.58H13z" />
      </svg>
    ),
  },
  {
    id: "facebook",
    label: "Facebook",
    href: import.meta.env.VITE_CONTACT_FACEBOOK || "https://facebook.com/harborstay",
    bg: "#1877f2",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.41-3.68 3.57-3.68 1.03 0 2.12.18 2.12.18v2.33h-1.2c-1.18 0-1.55.73-1.55 1.48v1.78h2.64l-.42 2.91h-2.22V22c4.78-.75 8.44-4.91 8.44-9.93z" />
      </svg>
    ),
  },
  {
    id: "instagram",
    label: "Instagram",
    href: import.meta.env.VITE_CONTACT_INSTAGRAM || "https://instagram.com/harborstay",
    bg: "linear-gradient(45deg,#f58529,#dd2a7b,#8134af)",
    icon: (
      <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
        <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm-.2 2A3.6 3.6 0 0 0 4 7.6v8.8A3.6 3.6 0 0 0 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6A3.6 3.6 0 0 0 16.4 4H7.6zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
      </svg>
    ),
  },
] as const;

export function ContactFab({ hidden = false }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hidden) setOpen(false);
  }, [hidden]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (hidden) return null;

  return (
    <div ref={rootRef} className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2.5">
      {open ? (
        <div className="flex flex-col items-end gap-2 animate-soft-in">
          {CONTACTS.map((c) => (
            <a
              key={c.id}
              href={c.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 no-underline"
              title={c.label}
            >
              <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-medium text-[var(--primary-deep)] shadow-sm border border-[var(--border)] opacity-0 translate-x-1 transition group-hover:opacity-100 group-hover:translate-x-0">
                {c.label}
              </span>
              <span
                className="flex size-11 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
                style={{ background: c.bg }}
              >
                {c.icon}
              </span>
            </a>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Đóng liên hệ" : "Liên hệ"}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-14 min-w-14 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 ${
          open ? "bg-[var(--primary-deep)]" : "bg-[var(--primary)]"
        }`}
      >
        {open ? (
          <span className="text-lg leading-none" aria-hidden>
            ×
          </span>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 11-3.2-6.8L21 3v9z" />
            </svg>
            <span className="hidden sm:inline">Liên hệ</span>
          </>
        )}
      </button>
    </div>
  );
}
