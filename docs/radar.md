# Live radar

`/radar`

## Data

HAFAS `JourneyGeoPos` (live) for the visible map area, up to 1000 trains, refreshed every 15 s and after panning/zooming.

**Look back** ("Time" control): a slider from now back to −180 min in 5-minute steps (`?ago=<min>` in the URL, linkable); the same request with that time. Positions and delays are then as of that time (the delay at the stop whose planned time is closest to it; the train panel marks the train's position at that time). The further back, the fewer trains have realtime data (2026-11-25, rail: 82 % at −90 min, 35 % at −180 min); the others are placed by the timetable. Further ideas (reconstruct from train runs, own recording): PLAN.md.

## How it is shown

- One dot per train. **Colour by delay** (default; classes like MÁV's [vonatinfo](https://vonatinfo.mav.hu/), colours from ColorBrewer — RdYlGn (green) by default, colour-blind-safe RdYlBu (blue) selectable in the radar legend and remembered for all maps): 7 classes from green (or dark blue) to red: on time / 1–2′ / 3–5′ / 6–9′ / 10–19′ / 20–59′ / ≥ 60′ (finer than vonatinfo in the low range), grey = no realtime data. The delay is the realtime deviation at the stop (of the few HAFAS sends around the train's position) whose planned time is closest to now. Switch between **colour by delay** and **colour by category** in the top bar ("Colour: Delay | Category"; the choice is remembered). The legend (bottom left) shows the counts per delay class or per category. Positions are **calculated by HAFAS** from the (realtime) timetable, not GPS. A small **arrow** at the edge of each dot shows the direction of travel (as on vonatinfo), from HAFAS `dirGeo` (32 steps counter-clockwise from east; checked against the direction between the previous and next stop).
- Product chips filter by HAFAS class (default: rail only).
- Hover (desktop) or first tap (touch) shows the train and its direction; click / second tap opens the train run.
- Map: [OpenFreeMap](https://openfreemap.org/) vector base map (Positron in light, Dark in dark theme; railway lines slightly emphasised). The [OpenRailwayMap](https://www.openrailwaymap.org/) overlay is on by default ("Railway map" toggle, switching it off is remembered), desaturated so it stays in the background. Same for all maps.
- **Click a train**: its run opens in a panel on the radar (bottom sheet on phones), like vonatinfo: stops with planned/realtime times, platforms, current delay, remarks; the route is drawn on the map. "Open train run →" leads to the full train page. The selection is in the URL (`?trip=`), so it can be linked; Esc, ✕ or the browser's back button close it.
