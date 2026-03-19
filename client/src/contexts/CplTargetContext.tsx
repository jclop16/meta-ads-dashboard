// CPL Target Context — shares the user-defined CPL goal across all dashboard components
import { createContext, useContext, useState, ReactNode } from "react";

interface CplTargetContextValue {
  cplTarget: number;
  setCplTarget: (v: number) => void;
  /** Returns "excellent" | "moderate" | "poor" relative to the user's target */
  getStatus: (cpl: number | null) => "excellent" | "moderate" | "poor";
  /** Returns the fill color for a given CPL relative to the target */
  getColor: (cpl: number | null) => string;
}

const CplTargetContext = createContext<CplTargetContextValue | null>(null);

// Default target = account average CPL
const DEFAULT_TARGET = 22.43;

export function CplTargetProvider({ children }: { children: ReactNode }) {
  const [cplTarget, setCplTarget] = useState(DEFAULT_TARGET);

  function getStatus(cpl: number | null): "excellent" | "moderate" | "poor" {
    if (cpl === null) return "moderate";
    if (cpl <= cplTarget) return "excellent";
    if (cpl <= cplTarget * 1.5) return "moderate";
    return "poor";
  }

  function getColor(cpl: number | null): string {
    const status = getStatus(cpl);
    if (status === "excellent") return "#00E676";
    if (status === "moderate") return "#FFB300";
    return "#FF3B5C";
  }

  return (
    <CplTargetContext.Provider value={{ cplTarget, setCplTarget, getStatus, getColor }}>
      {children}
    </CplTargetContext.Provider>
  );
}

export function useCplTarget() {
  const ctx = useContext(CplTargetContext);
  if (!ctx) throw new Error("useCplTarget must be used inside CplTargetProvider");
  return ctx;
}
