// Einstellbare Konstanten. Benutzer-Regler liegen in params.ts.
export const CONFIG = {
  gravity: 9.81, // m/s^2 (echte Physik)
  timeScale: 1, // Echtzeit-Wiedergabe (Sim-Sekunden pro Wand-Sekunde)
  fixedDt: 1 / 120, // Physik-Schritt in Sim-Sekunden
  maxStepsPerFrame: 300, // Schutz gegen Todesspirale nach Tab-Stillstand

  plane: {
    size: 30, // Meter (quadratisch)
  },

  wind: {
    response: 1.5, // 1/s — wie schnell sich der Tropfen der Windgeschwindigkeit angleicht (horizontaler Luftwiderstand)
    particleResponse: 2.5, // Partikel sind leichter, reagieren schneller
  },

  drop: {
    displayRadiusMin: 0.15, // m — sichtbare Kugel bei size = 1 mm
    displayRadiusMax: 0.6, // m — sichtbare Kugel bei size = 20 mm
    stretchK: 0.006, // Geschwindigkeits-Streckung pro m/s (sanft — Tropfen bleiben runder)
    stretchMax: 1.4,
    // Oberflächenspannung kann große Tropfen nicht kugelförmig halten: oberhalb der
    // Schwelle flachen sie entlang der Fallachse ab (abgeplattete "Hamburger"-Form)
    // und wölben sich am Äquator, statt sich zu einem Tropfen zu strecken.
    oblateOnsetMm: 4, // mm — Abflachung beginnt oberhalb dieses Durchmessers
    oblateK: 0.03, // Abflach-Anteil pro mm oberhalb der Schwelle
    oblateMax: 0.35, // Obergrenze für Abflach-Anteil
    spawnClamp: 13, // m — max |spawn x|-Versatz, damit der Tropfen über der Ebene bleibt
  },

  splat: {
    sizeFactor: 2.8, // Hauptradius = displayRadius * factor * speedTerm * viscTerm
    refSpeed: 15, // m/s Referenz für Wurzel-Geschwindigkeitsskalierung
    viscShrink: 0.3, // radius *= (1 - viscShrink * visc)
    opacityViscGain: 0.35, // dicker = undurchsichtiger
    minRadius: 0.12, // m
    maxRadius: 10.0, // m
    jitter: 0.2, // +/- gleichmäßiges Skalierungs-Jitter
    aspectJitter: 0.2, // ovale Variation
  },

  particles: {
    baseCount: 70,
    countSpeedK: 3.6, // Anzahl wächst mit Aufprallgeschwindigkeit * Größe
    minCount: 28,
    maxCount: 300,
    viscCountShrink: 0.8, // count *= (1 - 0.8 * visc)
    // Radiales Streumodell: jedes Tröpfchen zielt auf einen Landeradius t (0..1).
    reachFactor: 0.16, // m max. Landeradius = reachFactor * impactSpeed^reachSpeedExp
    reachSpeedExp: 1.35, // >1 => höherer Fall streut Tröpfchen überproportional weiter
    reachPlaneFrac: 0.95, // Reichweite auf diesen Anteil der halben Ebenengröße begrenzen
    reachViscShrink: 0.5, // reach *= (1 - 0.5 * visc)
    radialExp: 0.5, // <1 verschiebt Flächendichte nach außen (0.5 = gleichmäßig über die Scheibe)
    radialInner: 0.25, // Spray beginnt bei diesem Anteil der Reichweite (hält Zentrum frei)
    arcUpFactor: 0.18, // vertikale Startgeschwindigkeit als Anteil der Aufprallgeschwindigkeit (bestimmt Flugzeit/Bogen)
    inheritHorizontal: 0.3, // erbt Anteil der horizontalen Tropfengeschwindigkeit
    displayRadius: 0.06, // m — Größe der fliegenden Tröpfchenkugel
    splatSizeFactor: 0.32, // Partikel-Splat-Radius relativ zum Haupt-Splat
    splatSizeViscGain: 0.6, // dicker = fettere Tröpfchen-Splats
    // Größe + Schweif abgestuft nach Landeradius (Zentrum -> Rand):
    innerSize: 1.15, // Größenskala im Zentrum (große Tröpfchen nahe dem Tropfen)
    outerSize: 0.3, // Größenskala am Rand (feine Tröpfchen)
    tailInner: 1.1, // Streifen-Seitenverhältnis nahe Zentrum (kurzer Schweif)
    tailOuter: 2.6, // Streifen-Seitenverhältnis am Rand (langer Schweif)
    capacity: 768, // Pool-Größe des Instanced Mesh (deckt überlappende Bursts ab)
  },

  camera: {
    fitMargin: 1.35, // Einrahmungshöhe multiplizieren
    minDistance: 7,
    elevationDeg: 18, // Kamera-Neigung über dem Horizont für Auto-Fit
    azimuthDeg: 25, // Kamera-Drehwinkel um Y für Auto-Fit
    lerp: 0.09, // Auto-Fit-Interpolationsgeschwindigkeit
  },

  paintResolution: 8192, // Render-Target-px über der 30-m-Ebene (GPU-gebacken, keine Upload-Kosten)

  print: {
    width: 4800, // Export-PNG-px — T-Shirt-Druck (neu gebacken aus Splat-Historie, nicht dem Live-Puffer)
    height: 6200,
  },
} as const;
