import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type UiChromeContextValue = {
  bookingWizardOpen: boolean;
  setBookingWizardOpen: (open: boolean) => void;
};

const UiChromeContext = createContext<UiChromeContextValue | null>(null);

export function UiChromeProvider({ children }: { children: ReactNode }) {
  const [bookingWizardOpen, setBookingWizardOpen] = useState(false);
  const value = useMemo(
    () => ({ bookingWizardOpen, setBookingWizardOpen }),
    [bookingWizardOpen],
  );
  return <UiChromeContext.Provider value={value}>{children}</UiChromeContext.Provider>;
}

export function useUiChrome() {
  const ctx = useContext(UiChromeContext);
  if (!ctx) {
    throw new Error("useUiChrome must be used within UiChromeProvider");
  }
  return ctx;
}
