/** HTML of the GPS map's divIcon markers; colours come from CSS variables set on each marker. */

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** A robot: halo, optional pulse and inspection sweep, selection ring, heading arrow (or a dot without one), name. */
export const robotHtml = (name: string) => `
<div class="netra-geo-robot">
  <svg width="64" height="64" viewBox="-32 -32 64 64" aria-hidden="true">
    <circle class="halo motion-live" r="16"><animate attributeName="r" values="13;24;13" dur="2s" repeatCount="indefinite"/></circle>
    <g class="sweep"><path class="motion-live" d="M0,0 L30,-10 A32,32 0 0 1 30,10 Z"><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3s" repeatCount="indefinite"/></path></g>
    <circle class="ring" r="19"/>
    <g class="arrow"><path d="M14,0 L-9,9 L-4,0 L-9,-9 Z"/></g>
    <circle class="dot" r="7"/>
  </svg>
  <span class="label">${esc(name)}</span>
</div>`;

/** An anomaly: a warning triangle that pulses while waiting for validation and ripples when it just arrived. */
export const anomalyHtml = (pending: boolean, fresh: boolean, label: string) => `
<div class="netra-geo-pin${pending ? ' pending' : ''}" title="${esc(label)}">
  <svg width="48" height="48" viewBox="-24 -24 48 48" aria-hidden="true">
    ${fresh ? '<circle class="ripple motion-live" r="12"><animate attributeName="r" values="10;24" dur="1.1s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.9;0" dur="1.1s" repeatCount="indefinite"/></circle>' : ''}
    ${pending ? '<circle class="ripple motion-live" r="10"><animate attributeName="r" values="9;19" dur="1.4s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1.4s" repeatCount="indefinite"/></circle>' : ''}
    <path d="M0,-13 L11.5,7.5 L-11.5,7.5 Z"/>
    <text y="5" text-anchor="middle">!</text>
  </svg>
</div>`;

/** A numbered stop of a route in the route colour. */
export const stopHtml = (n: number, color: string) => `<div class="netra-geo-stop" style="--route:${esc(color)}">${n}</div>`;

/** A numbered control point pin. */
export const controlPointHtml = (n: number, label: string, active: boolean, warn: boolean) =>
  `<div class="netra-geo-cp${active ? ' active' : ''}${warn ? ' warn' : ''}" title="${esc(label)}"><span>${n}</span></div>`;
