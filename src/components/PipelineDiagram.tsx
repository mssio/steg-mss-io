import { useId } from 'react'

/*
 * message → encrypt → error correction → 8×8 blocks, drawn inline so it takes
 * the theme's colours (Tailwind fill/stroke utilities on the CSS tokens).
 * Wide screens get one row; phones get a 2×2 "snake" that reads 1 → 2 ↓ 3 → 4.
 */

const W = 190
const H = 170

const mono = 'font-mono'

function Frame({ label }: { label: string }) {
  return (
    <>
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="10" className="fill-card stroke-border-strong" />
      <text x="16" y="24" className={`${mono} fill-muted-foreground`} fontSize="9" letterSpacing="0.08em">
        {label}
      </text>
    </>
  )
}

function MessagePanel() {
  return (
    <g>
      <Frame label="PLAIN TEXT" />
      <g className="font-display fill-foreground" fontSize="23">
        <text x="16" y="66">Meet me at the</text>
        <text x="16" y="96">old lighthouse</text>
        <text x="16" y="126">at six.</text>
      </g>
      <rect x="66" y="109" width="2" height="22" className="fill-primary" />
    </g>
  )
}

const HEX = ['9F 3A C1 07 5E', 'B2 E8 14 6D A0', '71 0C F3 9B 2E', 'D4 58 A7 C6 13']

function CipherPanel() {
  return (
    <g>
      <Frame label="AES-256-GCM" />
      <g className={`${mono} fill-foreground`} fontSize="13.5" letterSpacing="0.04em">
        {HEX.map((line, i) => (
          <text key={line} x="16" y={62 + i * 24} opacity={1 - i * 0.12}>
            {line}
          </text>
        ))}
      </g>
      {/* A small padlock: only the password opens it. */}
      <g transform="translate(160 14)" className="stroke-primary" fill="none" strokeWidth="1.4">
        <rect x="0.5" y="6" width="13" height="10" rx="2" />
        <path d="M3.5 6V4a3.5 3.5 0 0 1 7 0v2" />
      </g>
    </g>
  )
}

// One Hamming(7,4) codeword, p1 p2 d1 p3 d2 d3 d4, for data 1011.
const CODEWORD = [0, 1, 1, 0, 0, 1, 1]
const PARITY = new Set([0, 1, 3])

function CodewordPanel() {
  const size = 15
  const gap = 4.5
  const x0 = (W - (7 * size + 6 * gap)) / 2
  return (
    <g>
      <Frame label="HAMMING(7,4) ×3" />
      {[0, 1, 2].map((copy) => (
        <g key={copy} transform={`translate(0 ${44 + copy * 27})`} opacity={1 - copy * 0.28}>
          {CODEWORD.map((bit, i) => {
            const parity = PARITY.has(i)
            // Whole class names, so Tailwind can see them.
            const tone = parity
              ? bit
                ? 'fill-primary stroke-primary'
                : 'fill-transparent stroke-primary'
              : bit
                ? 'fill-foreground stroke-foreground'
                : 'fill-transparent stroke-foreground'
            return (
              <rect
                key={i}
                x={x0 + i * (size + gap) + 0.5}
                y="0.5"
                width={size - 1}
                height={size - 1}
                rx="2.5"
                strokeWidth="1"
                className={tone}
              />
            )
          })}
        </g>
      ))}
      <g className={`${mono} fill-muted-foreground`} fontSize="9" textAnchor="middle">
        {CODEWORD.map((_, i) => (
          <text key={i} x={x0 + i * (size + gap) + size / 2} y="146" className={PARITY.has(i) ? 'fill-primary' : undefined}>
            {PARITY.has(i) ? 'p' : 'd'}
          </text>
        ))}
      </g>
    </g>
  )
}

function BlockPanel() {
  const cell = 13
  const x0 = (W - 8 * cell) / 2
  const y0 = 38
  const cells = []
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const centre = r >= 2 && r < 6 && c >= 2 && c < 6
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={x0 + c * cell + 0.5}
          y={y0 + r * cell + 0.5}
          width={cell - 1}
          height={cell - 1}
          rx="1"
          strokeWidth="0.75"
          className={centre ? 'fill-primary stroke-primary' : 'fill-muted stroke-border-strong'}
          opacity={centre ? 0.85 : 1}
        />,
      )
    }
  }
  return (
    <g>
      <Frame label="CENTRE VS EDGE" />
      {cells}
      <text x={W / 2} y="158" textAnchor="middle" className={`${mono} fill-muted-foreground`} fontSize="9" letterSpacing="0.06em">
        ONE 8×8 PIXEL BLOCK
      </text>
    </g>
  )
}

const PANELS = [
  { Panel: MessagePanel, caption: 'Your message' },
  { Panel: CipherPanel, caption: 'Encrypted' },
  { Panel: CodewordPanel, caption: 'Error correction' },
  { Panel: BlockPanel, caption: '8×8 blocks' },
]

const VERBS = ['ENCRYPT', 'PROTECT', 'EMBED']

function Arrow({ x1, y1, x2, y2, label, labelAt }: { x1: number; y1: number; x2: number; y2: number; label?: string; labelAt?: [number, number] }) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const head = 6
  const a1 = angle + Math.PI * 0.82
  const a2 = angle - Math.PI * 0.82
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-primary" strokeWidth="1.25" strokeDasharray="3 3" />
      <path
        d={`M${x2 + head * Math.cos(a1)} ${y2 + head * Math.sin(a1)} L${x2} ${y2} L${x2 + head * Math.cos(a2)} ${y2 + head * Math.sin(a2)}`}
        className="stroke-primary"
        fill="none"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {label && labelAt ? (
        <text x={labelAt[0]} y={labelAt[1]} textAnchor="middle" className={`${mono} fill-primary`} fontSize="9" letterSpacing="0.08em">
          {label}
        </text>
      ) : null}
    </g>
  )
}

function Caption({ x, y, n, text }: { x: number; y: number; n: number; text: string }) {
  return (
    <text x={x} y={y} textAnchor="middle" className="fill-foreground" fontSize="13">
      <tspan className={`${mono} fill-primary`} fontSize="10">
        {`0${n}`}
      </tspan>
      <tspan dx="7">{text}</tspan>
    </text>
  )
}

const TITLE = 'How a message is hidden'
const DESC =
  'Your message is encrypted with your password, protected with Hamming error-correcting codes repeated three times, then written into the photo as tiny brightness shifts between the centre and the edge of 8 by 8 pixel blocks.'

/** Wide: one row of four panels. */
function Row({ id }: { id: string }) {
  const gap = 80
  return (
    <svg viewBox={`0 0 ${4 * W + 3 * gap} 214`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{TITLE}</title>
      <desc id={`${id}-d`}>{DESC}</desc>
      <g aria-hidden="true">
        {PANELS.map(({ Panel, caption }, i) => {
          const x = i * (W + gap)
          return (
            <g key={caption}>
              <g transform={`translate(${x} 0)`}>
                <Panel />
              </g>
              <Caption x={x + W / 2} y={H + 34} n={i + 1} text={caption} />
              {i < 3 ? (
                <Arrow x1={x + W + 10} y1={H / 2} x2={x + W + gap - 10} y2={H / 2} label={VERBS[i]} labelAt={[x + W + gap / 2, H / 2 - 10]} />
              ) : null}
            </g>
          )
        })}
      </g>
    </svg>
  )
}

/** Narrow: a 2×2 snake (1 → 2, down to 3, back to 4). */
function Snake({ id }: { id: string }) {
  const s = 0.72
  const w = W * s
  const h = H * s
  const gapX = 320 - 2 * w
  const rowH = h + 64
  const at = [
    [0, 0],
    [w + gapX, 0],
    [w + gapX, rowH],
    [0, rowH],
  ]
  return (
    <svg viewBox={`0 0 320 ${rowH + h + 30}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
      <title id={`${id}-t`}>{TITLE}</title>
      <desc id={`${id}-d`}>{DESC}</desc>
      <g aria-hidden="true">
        {PANELS.map(({ Panel, caption }, i) => {
          const [x, y] = at[i]
          return (
            <g key={caption}>
              <g transform={`translate(${x} ${y}) scale(${s})`}>
                <Panel />
              </g>
              <Caption x={x + w / 2} y={y + h + 22} n={i + 1} text={caption} />
            </g>
          )
        })}
        <Arrow x1={w + 6} y1={h / 2} x2={w + gapX - 6} y2={h / 2} />
        <Arrow x1={w + gapX + w / 2} y1={h + 32} x2={w + gapX + w / 2} y2={rowH - 6} />
        <Arrow x1={w + gapX - 6} y1={rowH + h / 2} x2={w + 6} y2={rowH + h / 2} />
      </g>
    </svg>
  )
}

export function PipelineDiagram({ className }: { className?: string }) {
  const id = useId()
  return (
    <figure className={className}>
      <div className="sm:hidden">
        <Snake id={`${id}-n`} />
      </div>
      <div className="max-sm:hidden">
        <Row id={`${id}-w`} />
      </div>
    </figure>
  )
}
