// Lightweight inline SVG icon set — no icon library dependency.
const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

export const PulseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2-7 4 14 2-9 2 2h4" />
  </svg>
)
export const DispatchIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 13l1.5-4.5A2 2 0 0 1 6.4 7H14l3 3h3a1 1 0 0 1 1 1v3h-2" />
    <circle cx="7.5" cy="17" r="2" />
    <circle cx="17.5" cy="17" r="2" />
    <path d="M9.5 17h6M9 5v4M7 7h4" />
  </svg>
)
export const HospitalIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4 21V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14" />
    <path d="M3 21h18M12 8v6M9 11h6" />
  </svg>
)
export const RouteIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="6" r="2.4" />
    <path d="M8.4 18H14a3.5 3.5 0 0 0 0-7H10a3.5 3.5 0 0 1 0-7h5.6" />
  </svg>
)
export const FlagIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
  </svg>
)
export const CheckIcon = (p) => (
  <svg {...base} {...p} strokeWidth={2.4}>
    <path d="M5 12l5 5L20 6" />
  </svg>
)
export const BoltIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
  </svg>
)
export const ClockIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)
export const PinIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
export const BedIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 18V8M3 12h13a4 4 0 0 1 4 4v2M3 18h18" />
    <circle cx="7" cy="10" r="1.4" />
  </svg>
)
export const WarnIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3 2 20h20L12 3z" />
    <path d="M12 10v4M12 17.5v.5" />
  </svg>
)
export const HeartIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 20s-7-4.6-9.2-9C1.3 8 3 4.5 6.5 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3C22 4.5 22.7 8 21.2 11 19 15.4 12 20 12 20z" />
  </svg>
)
export const AmbulanceIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M2 7h11v9H2zM13 10h4l3 3v3h-7z" />
    <circle cx="6.5" cy="18" r="1.8" />
    <circle cx="16.5" cy="18" r="1.8" />
    <path d="M6 3.5v3M4.5 5h3" />
  </svg>
)
