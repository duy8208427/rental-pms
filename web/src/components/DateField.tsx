import { useEffect, useState } from "react";

type DateFieldProps = {
  value: string; // YYYY-MM-DD
  onChange: (iso: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  min?: string;
  max?: string;
};

function isoToDisplay(iso: string): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string | null {
  const m = display.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function maskInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({
  value,
  onChange,
  className = "",
  required,
  disabled,
  id,
  min,
  max,
}: DateFieldProps) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(isoToDisplay(value));
    setInvalid(false);
  }, [value]);

  function commit(display: string) {
    if (!display.trim()) {
      setInvalid(false);
      onChange("");
      return;
    }
    const iso = displayToIso(display);
    if (!iso) {
      setInvalid(true);
      return;
    }
    if (min && iso < min) {
      setInvalid(true);
      return;
    }
    if (max && iso > max) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(iso);
  }

  return (
    <div className={`hs-date-field ${className}`.trim()}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        className={`field${invalid ? " hs-date-invalid" : ""}`}
        value={text}
        disabled={disabled}
        required={required}
        onChange={(e) => setText(maskInput(e.target.value))}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(text);
          }
        }}
      />
      <input
        type="date"
        className="hs-date-native"
        value={value || ""}
        min={min}
        max={max}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onChange(e.target.value);
          setText(isoToDisplay(e.target.value));
          setInvalid(false);
        }}
      />
    </div>
  );
}
