import type { SafetyFigureKind } from '@/lib/hazards/safetyGuides';

function Person({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} className="text-primary">
    <circle cy="-24" r="5" fill="currentColor" stroke="none" />
    <path d="M0-16v16m0-12-9 8m9-8 10 6M0 0l-8 14M0 0l8 14" />
  </g>;
}

function House({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} className="text-secondary">
    <path d="m0 19 26-21 26 21" />
    <path d="M7 14v35h38V14" className="fill-panel" />
    <path d="M22 49V29h10v20M13 22h8v8h-8" />
  </g>;
}

function Arrow({ x, y, rotate = 0 }: { x: number; y: number; rotate?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rotate})`} className="text-accent-text">
    <path d="M0 0h34m-10-10L34 0 24 10" strokeWidth="3" />
  </g>;
}

function Water({ y }: { y: number }) {
  return <g className="text-info-text">
    <path d={`M8 ${y}q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0v${128-y}H8Z`} stroke="none" className="fill-info-bg" />
    <path d={`M8 ${y}q12-8 24 0t24 0 24 0 24 0 24 0 24 0 24 0 24 0M16 ${y+13}h21m17 0h32m31 0h25`} />
  </g>;
}

function StopSign({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} className="text-error-text">
    <circle r="18" className="fill-panel" strokeWidth="3" />
    <path d="m-12 12 24-24" strokeWidth="3" />
  </g>;
}

/** Instructional scenes supplement the adjacent text; no safety step relies on the figure alone. */
export function HazardSafetyFigure({ kind }: { kind: SafetyFigureKind }) {
  return <svg viewBox="0 0 224 132" aria-hidden="true" focusable="false"
    className="h-auto w-full" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {kind === 'kit' && <>
      <path d="M12 113h200" className="text-default" />
      <g className="text-accent-text">
        <rect x="62" y="42" width="76" height="68" rx="12" className="fill-panel" />
        <path d="M82 42v-7a10 10 0 0 1 10-10h16a10 10 0 0 1 10 10v7M62 65h76M90 79h20m-10-10v20" />
        <rect x="73" y="93" width="54" height="10" rx="3" className="fill-accent/10" />
      </g>
      <g className="text-info-text"><rect x="23" y="72" width="23" height="38" rx="5" className="fill-info-bg" /><path d="M29 72V61h11v11M24 88h21" /></g>
      <g className="text-secondary"><rect x="155" y="76" width="45" height="34" rx="5" className="fill-panel" /><path d="m163 76 20-24M164 86h8m-8 8h8m-8 8h8" /><circle cx="186" cy="94" r="7" /></g>
    </>}
    {(kind === 'route' || kind === 'shelter') && <>
      <path d="M10 113h204" className="text-default" />
      <House x={14} y={60} />
      <path d="M70 109c22 0 12-36 40-36s10 36 38 36" strokeDasharray="4 5" className="text-muted-foreground" />
      <g className="text-accent-text"><path d="m154 53 25-20 25 20M160 49v60h38V49" className="fill-panel" /><path d="M174 109V89h12v20m-15-29 6 6 12-15" /></g>
      <Arrow x={87} y={48} />
    </>}
    {kind === 'higher-ground' && <>
      <Water y={103} />
      <path d="M97 124 135 79h76v45" className="fill-panel text-secondary" />
      <House x={152} y={28} />
      <Person x={99} y={69} />
      <Arrow x={111} y={47} rotate={-26} />
      <path d="M13 78h38m-22-9 9 9-9 9" className="text-info-text" />
    </>}
    {kind === 'floodwater' && <>
      <path d="M12 109h65V87h135" className="text-secondary" />
      <Water y={97} />
      <Person x={40} y={76} />
      <g className="text-secondary"><path d="m131 76 7-17h37l12 17m-62 0h68v19h-68Z" className="fill-panel" /><circle cx="140" cy="95" r="5" className="fill-panel" /><circle cx="180" cy="95" r="5" className="fill-panel" /></g>
      <StopSign x={110} y={47} />
    </>}
    {kind === 'slope' && <>
      <path d="M10 20h37l78 89h88v14H10Z" className="fill-warning-bg text-warning-text" />
      <path d="m56 48 5-8 10 7-3 10Zm22 23 7-8 12 9-5 8Z" className="fill-caution-bg text-warning-text" />
      <path d="m39 50 38 43m-13-3 13 3-1-13" className="text-warning-text" strokeDasharray="4 4" />
      <Person x={150} y={91} />
      <Arrow x={167} y={65} />
    </>}
    {kind === 'road' && <>
      <path d="M10 104h204M12 119h202M20 111h26m135 0h24" className="text-secondary" />
      <path d="m108 104 10-22 20 6 10 16m-26 0 16-30 21 30" className="fill-warning-bg text-warning-text" />
      <g className="text-secondary"><path d="m27 82 8-16h32l12 16m-58 0h65v17H21Z" className="fill-panel" /><circle cx="34" cy="100" r="5" className="fill-panel" /><circle cx="74" cy="100" r="5" className="fill-panel" /></g>
      <StopSign x={128} y={45} />
    </>}
    {kind === 'coast' && <>
      <Water y={100} />
      <path d="M77 124 142 78h72v46" className="fill-panel text-secondary" />
      <House x={155} y={27} />
      <Person x={110} y={78} />
      <Arrow x={119} y={52} rotate={-27} />
      <path d="M13 83c19 3 24-13 16-24 28 4 33 24 37 33" className="text-info-text" />
    </>}
    {kind === 'all-clear' && <>
      <path d="M10 113h204" className="text-default" />
      <House x={144} y={60} />
      <Person x={42} y={94} />
      <g className="text-warning-text"><path d="M76 85h64v15H76ZM83 100v13m50-13v13M79 85l15 15m0-15 15 15m0-15 15 15m0-15 13 13" className="fill-warning-bg" /></g>
      <g className="text-accent-text"><rect x="89" y="20" width="38" height="43" rx="5" className="fill-panel" /><path d="M96 31h24m-24 8h13m-13 8h13" /><circle cx="119" cy="53" r="12" className="fill-panel" /><path d="m114 53 4 4 7-8" /></g>
    </>}
    {kind === 'utilities' && <>
      <House x={19} y={57} />
      <g className="text-secondary"><path d="M158 20v93m-25-73h50m-43-9h36M72 47c40 9 41-16 61-7" /><path d="m181 40 7 28-8 13 14 13" className="text-warning-text" /></g>
      <StopSign x={112} y={82} />
      <path d="M10 114h202" className="text-default" />
    </>}
    {kind === 'report' && <>
      <g className="text-secondary"><rect x="27" y="22" width="49" height="91" rx="9" className="fill-panel" /><path d="M42 32h19m-13 71h7" /><path d="M35 45h33v43H35Z" className="fill-muted" /></g>
      <path d="m43 61 6 6 11-14" className="text-accent-text" strokeWidth="3" />
      <Person x={151} y={93} />
      <g className="text-accent-text"><rect x="169" y="43" width="35" height="29" rx="7" className="fill-panel" /><path d="m175 72-6 8V66m12-8h11m-5-6v12" /></g>
      <path d="M11 114h202" className="text-default" />
    </>}
  </svg>;
}
