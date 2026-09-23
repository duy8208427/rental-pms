import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
};

export function Select({
  value,
  onChange,
  options,
  className = "",
  placeholder = "— Chọn —",
  required = false,
  disabled = false,
  id,
  name,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const idx = Math.max(
      0,
      options.findIndex((o) => o.value === value),
    );
    setHighlight(idx >= 0 ? idx : 0);

    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, options, value, close]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function pick(next: string) {
    onChange(next);
    close();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setHighlight((h) => {
        if (options.length === 0) return -1;
        const cur = h < 0 ? (e.key === "ArrowDown" ? -1 : 0) : h;
        if (e.key === "ArrowDown") return Math.min(options.length - 1, cur + 1);
        return Math.max(0, cur - 1);
      });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (highlight >= 0 && options[highlight]) pick(options[highlight].value);
    }
  }

  const wrapperClass = ["hs-select", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} ref={rootRef}>
      <select
        className="hs-select-native"
        tabIndex={-1}
        aria-hidden
        value={value}
        required={required}
        disabled={disabled}
        name={name}
        onChange={() => {}}
      >
        {required && !value ? <option value="" /> : null}
        {options.map((o) => (
          <option key={o.value || "__empty"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        id={id}
        className={`hs-select-trigger${open ? " is-open" : ""}`}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (disabled ? undefined : setOpen((o) => !o))}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "" : "hs-select-placeholder"}>
          {selected?.label ?? placeholder}
        </span>
        <span className="hs-select-chevron" aria-hidden />
      </button>

      {open ? (
        <ul
          id={listId}
          ref={listRef}
          className="hs-select-menu"
          role="listbox"
          aria-activedescendant={
            highlight >= 0 ? `${listId}-opt-${highlight}` : undefined
          }
        >
          {options.length === 0 ? (
            <li className="hs-select-option is-empty">Không có lựa chọn</li>
          ) : (
            options.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === highlight;
              return (
                <li
                  key={o.value || `__empty-${i}`}
                  id={`${listId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  className={`hs-select-option${isSelected ? " is-selected" : ""}${
                    isActive ? " is-active" : ""
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o.value);
                  }}
                >
                  {o.label}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
