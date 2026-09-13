/* Little painted sprigs. Every card in the reference has one tucked into a corner 
   they are what stop the layout reading as boxes on a page. */
export function Sprig({ kind = 'tulip', className, style }: { kind?: 'tulip' | 'leaf' | 'cosmos' | 'bell'; className?: string; style?: React.CSSProperties }) {
 if (kind === 'leaf') return <svg className={className} style={style} viewBox="0 0 64 78" fill="none" aria-hidden="true">
  <path d="M30 76V34" stroke="#6FA765" strokeWidth="2.6" strokeLinecap="round"/>
  <path d="M29 44c-3-10-11-15-23-16 1 13 9 20 23 16z" fill="#9CCB8F"/>
  <path d="M31 36c2-11 10-17 23-18-1 14-9 22-23 18z" fill="#7FB878"/>
  <path d="M29 60c-2-8-8-12-18-13 1 10 7 16 18 13z" fill="#B6DCA6"/>
 </svg>
 if (kind === 'cosmos') return <svg className={className} style={style} viewBox="0 0 64 78" fill="none" aria-hidden="true">
  <path d="M32 76V32" stroke="#6FA765" strokeWidth="2.6" strokeLinecap="round"/>
  <path d="M31 52c-3-9-10-13-20-14 1 11 8 17 20 14z" fill="#9CCB8F"/>
  {[0, 51, 102, 153, 204, 255, 306].map(a => <ellipse key={a} cx="32" cy="18" rx="6.4" ry="11" fill={a % 102 ? '#F7C3D8' : '#E9A0BF'} transform={`rotate(${a} 32 30)`}/>)}
  <circle cx="32" cy="30" r="5.4" fill="#F7C948"/>
 </svg>
 if (kind === 'bell') return <svg className={className} style={style} viewBox="0 0 64 78" fill="none" aria-hidden="true">
  <path d="M34 76c-2-24-4-40-4-54" stroke="#6FA765" strokeWidth="2.6" strokeLinecap="round"/>
  <path d="M32 56c-3-8-9-12-19-13 1 10 7 16 19 13z" fill="#9CCB8F"/>
  {[[30, 22], [40, 34], [24, 38]].map(([x, y], i) => <g key={i}>
   <path d={`M${x} ${y}c-6 0-9 5-9 9s4 7 9 7 9-3 9-7-3-9-9-9z`} fill={i % 2 ? '#A9C4EC' : '#88A6DA'}/>
  </g>)}
 </svg>
 return <svg className={className} style={style} viewBox="0 0 64 78" fill="none" aria-hidden="true">
  <path d="M32 76V38" stroke="#6FA765" strokeWidth="2.8" strokeLinecap="round"/>
  <path d="M31 54c-3-10-11-15-22-16 1 12 9 19 22 16z" fill="#9CCB8F"/>
  <path d="M33 48c2-9 9-14 20-15-1 11-8 18-20 15z" fill="#7FB878"/>
  <path d="M32 10c7 0 13 6 13 14 0 9-6 15-13 15s-13-6-13-15c0-8 6-14 13-14z" fill="#F7CE63"/>
  <path d="M32 10c-4 4-6 9-6 15s2 11 6 14c4-3 6-8 6-14s-2-11-6-15z" fill="#F2B441"/>
 </svg>
}
