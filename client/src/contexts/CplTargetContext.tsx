// CPL Target Context — shares the user-defined CPL goal across all dashboard components
// Now backed by the database: loads on mount, persists on change
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

export type CplStatus = "excellent" | "moderate" | "poor";

interface CplTargetContextValue {
  cplTarget: number;
  setCplTarget: (v: number) => void;
  /** Returns "excellent" | "moderate" | "poor" relative to the user's target */
  getStatus: (cpl: number | null) => CplStatus;
  /** Returns the fill color for a given CPL relative to the target */
  getColor: (cpl: number | null) => string;
  /** True while the initial DB value is loading */
  isLoading: boolean;
}

const CplTargetContext = createContext<CplTargetContextValue | null>(null);

const DEFAULT_TARGET = 22.43;

export function CplTargetProvider({ children }: { children: ReactNode }) {
  const [cplTarget, setCplTargetLocal] = useState(DEFAULT_TARGET);

  // Load persisted value from DB on mount
  const { data, isLoading } = trpc.settings.getCplTarget.useQuery(undefined, {
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.cplTarget != null) {
      setCplTargetLocal(data.cplTarget);
    }
  }, [data]);

  // Persist to DB whenever user changes the target
  const setCplTargetMutation = trpc.settings.setCplTarget.useMutation();
  const utils = trpc.useUtils();

  const setCplTarget = useCallback(
    (v: number) => {
      setCplTargetLocal(v);
      setCplTargetMutation.mutate(
        { value: v },
        {
          onSuccess: () => {
            utils.settings.getCplTarget.invalidate();
          },
        }
      );
    },
    [setCplTargetMutation, utils]
  );

  const getStatus = useCallback(
    (cpl: number | null): CplStatus => {
      if (cpl == null) return "moderate";
      if (cpl <= cplTarget) return "excellent";
      if (cpl <= cplTarget * 1.5) return "moderate";
      return "poor";
    },
    [cplTarget]
  );

  const getColor = useCallback(
    (cpl: number | null): string => {
      const status = getStatus(cpl);
      if (status === "excellent") return "#00E676";
      if (status === "moderate") return "#FFB300";
      return "#FF3B5C";
    },
    [getStatus]
  );

  return (
    <CplTargetContext.Provider value={{ cplTarget, setCplTarget, getStatus, getColor, isLoading }}>
      {children}
    </CplTargetContext.Provider>
  );
}

export function useCplTarget() {
  const ctx = useContext(CplTargetContext);
  if (!ctx) throw new Error("useCplTarget must be used inside CplTargetProvider");
  return ctx;
}
