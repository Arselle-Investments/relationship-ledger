"use client";

import { useMemo } from "react";
import { Event } from "@prisma/client";
import { inferState } from "@/lib/region";
import { projectState, INSET_STATES } from "@/lib/state-centroids";

const MAP_W = 960;
const MAP_H = 560;

function radiusFor(count: number) {
  return Math.min(6 + Math.sqrt(count) * 7, 42);
}

export function EventsMap({ events }: { events: Event[] }) {
  const { counts, unmapped } = useMemo(() => {
    const counts = new Map<string, number>();
    let unmapped = 0;
    for (const ev of events) {
      const state = inferState(ev.name, ev.location);
      if (!state) {
        unmapped++;
        continue;
      }
      counts.set(state, (counts.get(state) ?? 0) + 1);
    }
    return { counts, unmapped };
  }, [events]);

  const dots = useMemo(() => {
    const out: { abbr: string; x: number; y: number; count: number }[] = [];
    for (const [abbr, count] of counts.entries()) {
      const pos = projectState(abbr);
      if (!pos) continue;
      out.push({ abbr, x: pos.x, y: pos.y, count });
    }
    return out.sort((a, b) => b.count - a.count);
  }, [counts]);

  const maxCount = dots.length > 0 ? dots[0].count : 0;

  if (events.length === 0) {
    return (
      <div className="empty">
        <h3>Nothing to show</h3>
        <div>No events match the current filter.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="content-wrap" style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", minWidth: 640, height: "auto" }}>
          <rect x={0} y={0} width={MAP_W} height={430} rx={10} fill="var(--slate-bg)" />
          {Object.entries(INSET_STATES).map(([abbr, pos]) => (
            <rect
              key={`box-${abbr}`}
              x={pos.x - 55}
              y={pos.y - 40}
              width={110}
              height={80}
              rx={8}
              fill="var(--slate-bg)"
              stroke="var(--line)"
              strokeDasharray="4 3"
            />
          ))}

          {dots.map((d) => {
            const r = radiusFor(d.count);
            return (
              <g key={d.abbr}>
                <circle cx={d.x} cy={d.y} r={r} fill="var(--brass)" fillOpacity={0.75} stroke="var(--brass-dark)" strokeWidth={1}>
                  <title>
                    {d.abbr}: {d.count} event{d.count === 1 ? "" : "s"}
                  </title>
                </circle>
                <text
                  x={d.x}
                  y={d.y + 3}
                  textAnchor="middle"
                  fontSize={r >= 14 ? 11 : 9}
                  fontFamily="'Work Sans', sans-serif"
                  fontWeight={700}
                  fill="#fff"
                  pointerEvents="none"
                >
                  {d.abbr}
                </text>
              </g>
            );
          })}

          {/* legend */}
          {maxCount > 0 && (
            <g transform={`translate(${MAP_W - 150}, ${430 - 20})`}>
              {[1, Math.max(2, Math.round(maxCount / 2)), maxCount]
                .filter((v, i, arr) => arr.indexOf(v) === i)
                .map((v, i) => {
                  const r = radiusFor(v);
                  const cx = 20 + i * 45;
                  return (
                    <g key={v}>
                      <circle cx={cx} cy={-r} r={r} fill="none" stroke="var(--ink-soft)" strokeWidth={1} />
                      <text x={cx} y={12} textAnchor="middle" fontSize={10} fontFamily="'Work Sans', sans-serif" fill="var(--ink-soft)">
                        {v}
                      </text>
                    </g>
                  );
                })}
            </g>
          )}
        </svg>
      </div>
      <div className="helptext" style={{ marginTop: 10 }}>
        Dot size = number of conferences in that state, inferred from each event&rsquo;s location text. Hover a dot for the exact count.
        {unmapped > 0 && (
          <>
            {" "}
            {unmapped} event{unmapped === 1 ? "" : "s"} with no clear state in the location (e.g. &ldquo;TBA&rdquo;) aren&rsquo;t shown.
          </>
        )}
      </div>
    </div>
  );
}
