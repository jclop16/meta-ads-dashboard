import { Moon, SunMedium } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme, switchable } = useTheme();

  if (!switchable || !toggleTheme) {
    return null;
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all hover:brightness-110"
      style={{
        background: "var(--dash-panel-soft)",
        border: "1px solid var(--dash-border)",
        color: "var(--dash-text)",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
    >
      {isDark ? <SunMedium size={14} style={{ color: "#FFB300" }} /> : <Moon size={14} style={{ color: "#2563EB" }} />}
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
