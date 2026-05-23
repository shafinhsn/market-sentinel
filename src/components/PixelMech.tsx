/**
 * Pixel-art mech agents rendered as SVG. Each agent has a distinct silhouette
 * and accent color. Animation reacts to status: idle / active (working) / done.
 */
type Status = "idle" | "active" | "done";

interface Props {
  index: number;       // 0-8, picks the mech variant
  status: Status;
  name: string;
  role: string;
}

// Palette per agent — accent (suit), secondary (armor), visor
const PALETTE = [
  { a: "#22d3ee", b: "#0e7490", v: "#ecfeff" }, // Alex - cyan
  { a: "#f59e0b", b: "#92400e", v: "#fef3c7" }, // Morgan - amber
  { a: "#a78bfa", b: "#5b21b6", v: "#ede9fe" }, // Jordan - violet
  { a: "#ef4444", b: "#991b1b", v: "#fee2e2" }, // Dana - red
  { a: "#34d399", b: "#065f46", v: "#d1fae5" }, // Sam - emerald
  { a: "#60a5fa", b: "#1e40af", v: "#dbeafe" }, // Torres - blue
  { a: "#f472b6", b: "#9d174d", v: "#fce7f3" }, // Deliberation - pink
  { a: "#fbbf24", b: "#78350f", v: "#fef9c3" }, // Riley - yellow
  { a: "#a3e635", b: "#3f6212", v: "#ecfccb" }, // Kai - lime
];

// 9 mech archetypes — each draws a slightly different silhouette
function MechSprite({ idx, color, working }: { idx: number; color: typeof PALETTE[0]; working: boolean }) {
  const armClass = working ? "anim-work" : "anim-bob";
  // Common pixel grid 16x16, scaled up by CSS
  return (
    <svg viewBox="0 0 16 20" className={`w-full h-full pixelated ${armClass}`} style={{ overflow: "visible" }}>
      {/* Antenna */}
      <rect x="7" y="0" width="2" height="1" fill={color.b} />
      <rect x="7" y="1" width="2" height="1" fill={color.a} className={working ? "anim-antenna" : ""} />

      {/* Head / helmet — varies by index */}
      {idx % 3 === 0 && <rect x="4" y="2" width="8" height="4" fill={color.b} />}
      {idx % 3 === 1 && <><rect x="3" y="2" width="10" height="3" fill={color.b} /><rect x="4" y="5" width="8" height="1" fill={color.b} /></>}
      {idx % 3 === 2 && <><rect x="4" y="2" width="8" height="1" fill={color.b} /><rect x="3" y="3" width="10" height="3" fill={color.b} /></>}

      {/* Visor */}
      <rect x="5" y="4" width="6" height="1" fill={color.v} className={working ? "" : "anim-visor"} />
      {working && <rect x="5" y="4" width="6" height="1" fill={color.a} className="anim-status" />}

      {/* Torso / chestplate — variants */}
      {idx < 3 && (
        <>
          <rect x="3" y="7" width="10" height="5" fill={color.b} />
          <rect x="6" y="8" width="4" height="2" fill={color.a} />
          <rect x="7" y="9" width="2" height="1" fill={color.v} />
        </>
      )}
      {idx >= 3 && idx < 6 && (
        <>
          <rect x="2" y="7" width="12" height="4" fill={color.b} />
          <rect x="3" y="8" width="2" height="2" fill={color.a} />
          <rect x="11" y="8" width="2" height="2" fill={color.a} />
          <rect x="7" y="9" width="2" height="2" fill={color.v} />
          <rect x="4" y="11" width="8" height="1" fill={color.b} />
        </>
      )}
      {idx >= 6 && (
        <>
          <rect x="3" y="7" width="10" height="2" fill={color.a} />
          <rect x="3" y="9" width="10" height="3" fill={color.b} />
          <rect x="6" y="9" width="4" height="1" fill={color.v} />
        </>
      )}

      {/* Shoulder pauldrons */}
      <rect x="1" y="7" width="2" height="3" fill={color.b} />
      <rect x="13" y="7" width="2" height="3" fill={color.b} />

      {/* Arms — animate when working */}
      <g className={working ? "anim-work" : ""} style={{ transformOrigin: "2px 10px" }}>
        <rect x="1" y="10" width="2" height="3" fill={color.b} />
        <rect x="1" y="13" width="2" height="1" fill={color.a} />
      </g>
      <g className={working ? "anim-work" : ""} style={{ transformOrigin: "14px 10px", animationDelay: "0.3s" }}>
        <rect x="13" y="10" width="2" height="3" fill={color.b} />
        <rect x="13" y="13" width="2" height="1" fill={color.a} />
      </g>

      {/* Legs / hover-base */}
      <rect x="4" y="13" width="3" height="3" fill={color.b} />
      <rect x="9" y="13" width="3" height="3" fill={color.b} />

      {/* Thruster flames when working */}
      {working && (
        <>
          <rect x="4" y="16" width="3" height="2" fill={color.a} className="anim-piston" />
          <rect x="9" y="16" width="3" height="2" fill={color.a} className="anim-piston" style={{ animationDelay: "0.2s" }} />
          <rect x="5" y="18" width="1" height="1" fill={color.v} className="anim-piston" />
          <rect x="10" y="18" width="1" height="1" fill={color.v} className="anim-piston" style={{ animationDelay: "0.2s" }} />
        </>
      )}
    </svg>
  );
}

export function PixelMech({ index, status, name, role }: Props) {
  const color = PALETTE[index % PALETTE.length];
  const working = status === "active";
  const done = status === "done";

  // Status light color
  const statusColor = done ? "#22c55e" : working ? color.a : "#475569";

  return (
    <div className={`relative overflow-hidden rounded-md border bg-[#0a0e1a] ${working ? "border-primary anim-bay-active" : done ? "border-emerald-500/40" : "border-border/50"}`}>
      {/* Bay interior */}
      <div className="relative h-24 bay-grid-bg flex items-end justify-center px-2">
        {/* Bay frame corners */}
        <div className="absolute top-1 left-1 w-2 h-2 border-l border-t" style={{ borderColor: statusColor, opacity: 0.6 }} />
        <div className="absolute top-1 right-1 w-2 h-2 border-r border-t" style={{ borderColor: statusColor, opacity: 0.6 }} />
        <div className="absolute bottom-1 left-1 w-2 h-2 border-l border-b" style={{ borderColor: statusColor, opacity: 0.6 }} />
        <div className="absolute bottom-1 right-1 w-2 h-2 border-r border-b" style={{ borderColor: statusColor, opacity: 0.6 }} />

        {/* Floor line */}
        <div className="absolute bottom-3 left-2 right-2 h-px" style={{ background: `linear-gradient(90deg, transparent, ${statusColor}66, transparent)` }} />

        {/* Mech */}
        <div className={`relative ${done ? "opacity-100" : working ? "opacity-100" : "opacity-50"}`} style={{ width: 44, height: 56 }}>
          <MechSprite idx={index} color={color} working={working} />
        </div>

        {/* Scanline overlay when working */}
        {working && <div className="scanline-overlay" />}

        {/* Bay number */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[8px] font-mono tracking-widest" style={{ color: statusColor }}>
          BAY-{String(index + 1).padStart(2, "0")}
        </div>
      </div>

      {/* Info bar */}
      <div className="px-2 py-1.5 border-t border-border/50 bg-[#070b14] flex items-center gap-2">
        <span className={`size-1.5 rounded-full ${working ? "anim-status" : ""}`} style={{ background: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium truncate leading-tight">{name}</div>
          <div className="text-[9px] text-muted-foreground truncate leading-tight font-mono uppercase">{role}</div>
        </div>
        <div className="text-[9px] font-mono" style={{ color: statusColor }}>
          {done ? "OK" : working ? "RUN" : "STBY"}
        </div>
      </div>
    </div>
  );
}
