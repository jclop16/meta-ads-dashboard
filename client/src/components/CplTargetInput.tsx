// CPL Target Input — lets the user set a custom CPL goal that drives all dashboard highlights
import { useState } from "react";
import { useCplTarget } from "@/contexts/CplTargetContext";
import { Target, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CplTargetInput() {
  const { cplTarget, setCplTarget } = useCplTarget();
  const [draft, setDraft] = useState(String(cplTarget));
  const [saved, setSaved] = useState(false);

  function handleCommit() {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed > 0) {
      setCplTarget(parsed);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCommit();
  }

  // Classify current target vs account average
  const accountAvg = 22.43;
  const diff = parseFloat(draft) - accountAvg;
  const diffLabel =
    isNaN(diff) ? "" :
    diff === 0 ? "= account avg" :
    diff < 0 ? `${Math.abs(diff).toFixed(2)} below avg` :
    `${diff.toFixed(2)} above avg`;
  const diffColor = diff < 0 ? "#00E676" : diff > 0 ? "#FF3B5C" : "#64748B";

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-4 py-2.5"
      style={{
        background: "color-mix(in srgb, var(--color-cyan) 8%, var(--dash-panel))",
        border: "1px solid color-mix(in srgb, var(--color-cyan) 18%, var(--dash-border))",
      }}
    >
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <Target size={13} style={{ color: "#00D4FF" }} />
        <span
          className="text-[10px] font-mono uppercase tracking-widest whitespace-nowrap"
          style={{ color: "var(--dash-muted)" }}
        >
          CPL Target
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-sm font-mono" style={{ color: "var(--dash-muted)" }}>$</span>
        <input
          type="number"
          min="1"
          step="0.01"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={handleKey}
          className="w-20 bg-transparent text-sm font-mono font-semibold outline-none border-b text-center"
          style={{
            color: "#00D4FF",
            borderColor: "color-mix(in srgb, var(--color-cyan) 30%, var(--dash-border))",
            caretColor: "#00D4FF",
          }}
        />
      </div>

      <AnimatePresence mode="wait">
        {saved ? (
          <motion.div
            key="check"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-1 text-[10px] font-mono"
            style={{ color: "#00E676" }}
          >
            <Check size={11} />
            Applied
          </motion.div>
        ) : (
          <motion.span
            key="diff"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[10px] font-mono whitespace-nowrap hidden sm:block"
            style={{ color: diffColor }}
          >
            {diffLabel}
          </motion.span>
        )}
      </AnimatePresence>

      <div
        className="hidden md:flex items-center gap-2 ml-1 text-[10px] font-mono"
        style={{ color: "var(--dash-subtle)" }}
      >
        <span style={{ color: "#00E676" }}>● ≤ target</span>
        <span style={{ color: "#FFB300" }}>● ≤ 1.5×</span>
        <span style={{ color: "#FF3B5C" }}>● &gt; 1.5×</span>
      </div>
    </div>
  );
}
