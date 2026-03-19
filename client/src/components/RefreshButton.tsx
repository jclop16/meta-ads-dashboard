// RefreshButton — triggers a live Meta Ads data pull for all date ranges
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface RefreshButtonProps {
  onRefreshComplete?: () => void;
}

export default function RefreshButton({ onRefreshComplete }: RefreshButtonProps) {
  const utils = trpc.useUtils();

  const refreshMutation = trpc.dashboard.refresh.useMutation({
    onSuccess: (data) => {
      // Invalidate all dashboard queries to reload with fresh data
      utils.dashboard.snapshots.invalidate();
      utils.dashboard.accountMetrics.invalidate();
      utils.dashboard.campaigns.invalidate();

      const savedCount = data.saved.length;
      const failedCount = data.failed.length;

      if (failedCount === 0) {
        toast.success(`Refreshed ${savedCount} date range${savedCount !== 1 ? "s" : ""} from Meta Ads`, {
          description: data.saved.join(" · "),
          duration: 5000,
        });
      } else {
        toast.warning(`Refreshed ${savedCount} ranges, ${failedCount} failed`, {
          description: `Failed: ${data.failed.join(", ")}`,
          duration: 6000,
        });
      }

      onRefreshComplete?.();
    },
    onError: (err) => {
      toast.error("Refresh failed", {
        description: err.message,
        duration: 6000,
      });
    },
  });

  const isLoading = refreshMutation.isPending;
  const isSuccess = refreshMutation.isSuccess;
  const isError = refreshMutation.isError;

  return (
    <motion.button
      onClick={() => refreshMutation.mutate()}
      disabled={isLoading}
      whileHover={{ scale: isLoading ? 1 : 1.03 }}
      whileTap={{ scale: isLoading ? 1 : 0.97 }}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed"
      style={{
        background: isLoading
          ? "rgba(0,212,255,0.05)"
          : isSuccess
          ? "rgba(0,230,118,0.1)"
          : isError
          ? "rgba(255,59,92,0.1)"
          : "rgba(0,212,255,0.1)",
        border: `1px solid ${
          isLoading
            ? "rgba(0,212,255,0.15)"
            : isSuccess
            ? "rgba(0,230,118,0.3)"
            : isError
            ? "rgba(255,59,92,0.3)"
            : "rgba(0,212,255,0.25)"
        }`,
        color: isLoading
          ? "rgba(0,212,255,0.5)"
          : isSuccess
          ? "#00E676"
          : isError
          ? "#FF3B5C"
          : "#00D4FF",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0 }}
          >
            <Loader2 size={14} className="animate-spin" />
          </motion.span>
        ) : isSuccess ? (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <CheckCircle size={14} />
          </motion.span>
        ) : isError ? (
          <motion.span
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AlertTriangle size={14} />
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <RefreshCw size={14} />
          </motion.span>
        )}
      </AnimatePresence>
      <span>
        {isLoading
          ? "Fetching from Meta Ads…"
          : isSuccess
          ? "Refreshed!"
          : isError
          ? "Retry Refresh"
          : "Refresh from Meta Ads"}
      </span>
    </motion.button>
  );
}
