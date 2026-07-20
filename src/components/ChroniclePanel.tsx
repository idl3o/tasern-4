"use client";

import { useWorldStore } from "@/state/worldStore";
import { APPROACHES } from "@/lib/rolls";
import { MOON_META, FACTION_IDS } from "@/lib/world/types";

// Overlay showing the living state of Tasern: the belief field, faction standings,
// the ascendant moon, recent canon events, and any reality shifts.
export function ChroniclePanel({ onClose }: { onClose: () => void }) {
  const world = useWorldStore((s) => s.world);
  if (!world) return null;

  const maxField = Math.max(1, ...APPROACHES.map((a) => world.beliefField[a] || 0));
  const factions = [...FACTION_IDS.map((id) => world.factions[id])].sort((a, b) => b.standing - a.standing);
  const moon = MOON_META[world.moons.ascendant];
  const recentEvents = [...world.events].slice(-4).reverse();
  const shifts = [...world.realityShifts].slice(-4).reverse();

  return (
    <div className="absolute top-10 right-4 z-40 w-72 max-h-[70vh] overflow-y-auto bg-void/95 border border-gold/30 rounded-lg p-5 shadow-2xl animate-fade-in">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gold text-sm tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
          Chronicle
        </h3>
        <button onClick={onClose} className="text-parchment/30 hover:text-parchment/60 text-xs">
          close
        </button>
      </div>

      {/* Belief field */}
      <div className="space-y-1.5 mb-4">
        <h4 className="text-purple-400/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
          Belief Field
        </h4>
        {APPROACHES.map((a) => {
          const v = world.beliefField[a] || 0;
          return (
            <div key={a} className="text-xs">
              <div className="flex justify-between text-parchment/60">
                <span>{a}</span>
                <span className="text-parchment/40">{v}</span>
              </div>
              <div className="h-1 bg-void/80 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400/60" style={{ width: `${(v / maxField) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ascendant moon */}
      <div className="space-y-1 mb-4">
        <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
          Ascendant Moon
        </h4>
        <p className="text-parchment/80 text-sm">{moon.name}</p>
        <p className="text-parchment/40 text-xs">{moon.effect}</p>
      </div>

      {/* Faction standings */}
      <div className="space-y-1 mb-4">
        <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
          Powers of Tasern
        </h4>
        <ul className="space-y-1">
          {factions.map((f) => (
            <li key={f.id} className="flex items-center justify-between text-xs">
              <span className={f.ascendant ? "text-gold" : "text-parchment/70"}>
                {f.ascendant && <span className="mr-1">★</span>}
                {f.name}
              </span>
              <span className="text-parchment/40">{Math.round(f.standing)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Reality shifts */}
      {shifts.length > 0 && (
        <div className="space-y-1 mb-4">
          <h4 className="text-purple-400/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
            Reality Shifts
          </h4>
          <ul className="space-y-1.5">
            {shifts.map((s) => (
              <li key={s.id} className="text-purple-300/70 text-xs">{s.description}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent canon events */}
      {recentEvents.length > 0 && (
        <div className="space-y-1 border-t border-gold/10 pt-3">
          <h4 className="text-gold/60 text-xs tracking-widest uppercase" style={{ fontFamily: "'Cinzel', serif" }}>
            Recent Chronicle
          </h4>
          <ul className="space-y-1.5">
            {recentEvents.map((e) => (
              <li key={e.id} className="text-parchment/50 text-xs leading-relaxed">{e.text}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
