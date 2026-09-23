/** Client-side field validation (mirrors backend Pydantic rules). */

const PERSON_NAME_RE = /^[^\W\d_]+(?:[ '\-][^\W\d_]+)*$/u;
const PHONE_RE = /^\d{9,11}$/;
const ID_NUMBER_RE = /^(\d{9}|\d{12})$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function sanitizeDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidPersonName(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && PERSON_NAME_RE.test(v);
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(sanitizeDigits(value));
}

export function isValidIdNumber(value: string): boolean {
  return ID_NUMBER_RE.test(sanitizeDigits(value));
}

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && EMAIL_RE.test(v);
}

export function personNameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Họ tên là bắt buộc";
  if (!isValidPersonName(v)) return "Họ tên chỉ gồm chữ cái, khoảng trắng, dấu ' hoặc -";
  return null;
}

export function phoneError(value: string, required = true): string | null {
  const digits = sanitizeDigits(value);
  if (!digits) return required ? "Số điện thoại là bắt buộc" : null;
  if (!isValidPhone(digits)) return "Số điện thoại chỉ gồm 9–11 chữ số";
  return null;
}

export function idNumberError(value: string, required = true): string | null {
  const digits = sanitizeDigits(value);
  if (!digits) return required ? "CCCD là bắt buộc" : null;
  if (!isValidIdNumber(digits)) return "CCCD phải gồm 9 hoặc 12 chữ số";
  return null;
}

export function emailError(value: string, required = true): string | null {
  const v = value.trim();
  if (!v) return required ? "Email là bắt buộc" : null;
  if (!isValidEmail(v)) return "Email không đúng định dạng";
  return null;
}
