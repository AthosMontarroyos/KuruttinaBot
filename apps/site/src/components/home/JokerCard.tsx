import { useId } from 'react';

/** Estrela de quatro pontas das cintilações. */
const star = 'M0,-7 L1.7,-1.7 L7,0 L1.7,1.7 L0,7 L-1.7,1.7 L-7,0 L-1.7,-1.7Z';
type Spark = { x: number; y: number; scale: number; delay: number };

function Sparks({ sparks }: { sparks: Spark[] }) {
  return (
    <>
      {sparks.map((spark, index) => (
        <g key={index} transform={`translate(${spark.x} ${spark.y}) scale(${spark.scale})`}>
          <path className="joker-spark fill-text" style={{ animationDelay: `calc(var(--joker-delay) + ${spark.delay}s)` }} d={star} />
        </g>
      ))}
    </>
  );
}

const indexStar = 'M15.5,28 l1.3,3 3,.4 -2.2,2 .6,3 -2.7,-1.5 -2.7,1.5 .6,-3 -2.2,-2 3,-.4z';
const serif = "font-['Noto_Serif_JP','Hiragino_Mincho_ProN',serif] font-bold";

/** Face do coringa: moldura dupla, índice "J" com estrela nos cantos, chapéu de bobo da corte com sinos e o 狂. */
function JokerFace() {
  const id = useId().replace(/:/gu, '');
  return (
    <svg className="block size-full overflow-visible" viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-clip`}><rect x="1.2" y="1.2" width="97.6" height="137.6" rx="8" /></clipPath>
        <linearGradient id={`${id}-sheen`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopOpacity="0" className="[stop-color:var(--color-text)]" />
          <stop offset=".5" stopOpacity=".2" className="[stop-color:var(--color-text)]" />
          <stop offset="1" stopOpacity="0" className="[stop-color:var(--color-text)]" />
        </linearGradient>
      </defs>
      <rect className="fill-background stroke-text" strokeWidth="2.4" x="1.2" y="1.2" width="97.6" height="137.6" rx="8" />
      <rect className="fill-none stroke-text" strokeWidth="1" opacity=".55" x="6" y="6" width="88" height="128" rx="4.5" />
      <rect className="fill-none stroke-text" strokeWidth="1" opacity=".25" x="8.4" y="8.4" width="83.2" height="123.2" rx="3" />
      {[false, true].map((flipped) => (
        <g key={String(flipped)} transform={flipped ? 'rotate(180 50 70)' : undefined}>
          <text className="fill-text font-sans font-bold" fontSize="12" x="12" y="24">J</text>
          <path className="fill-text" d={indexStar} transform="translate(-1.5 0) scale(.95)" />
        </g>
      ))}
      <g className="fill-text">
        <path d="M30,76 C18,70 12,52 14,38 C22,50 34,56 44,66Z" />
        <path d="M42,66 C40,50 44,32 52,20 C57,36 60,52 58,66Z" />
        <path d="M70,76 C82,70 88,52 86,38 C78,50 66,56 56,66Z" />
        <rect x="28" y="73" width="44" height="9" rx="4.5" />
        <circle cx="14" cy="36" r="4.2" /><circle cx="52" cy="18" r="4.2" /><circle cx="86" cy="36" r="4.2" />
      </g>
      <path className="fill-background" d="M36,77.5 l3,-3 3,3 -3,3z M48.5,77.5 l3,-3 3,3 -3,3z M61,77.5 l3,-3 3,3 -3,3z" />
      <text className={`fill-text ${serif}`} x="50" y="118" fontSize="30" textAnchor="middle">狂</text>
      <path className="stroke-text" strokeWidth="1" opacity=".4" d="M22,125 H78" />
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="skewX(-18)"><rect className="joker-sheen" x="-30" y="-10" width="34" height="170" fill={`url(#${id}-sheen)`} /></g>
      </g>
      <Sparks sparks={[{ x: 94, y: 12, scale: 1, delay: 0 }, { x: 4, y: 70, scale: 0.7, delay: 0.9 }, { x: 88, y: 128, scale: 0.9, delay: 1.6 }]} />
    </svg>
  );
}

/** Verso: losangos com moldura dupla e um medalhão com a lua e o 狂. */
function JokerBack() {
  const id = useId().replace(/:/gu, '');
  const lines = Array.from({ length: 14 }, (_, index) => index);
  return (
    <svg className="block size-full overflow-visible" viewBox="0 0 100 140" aria-hidden="true">
      <defs>
        <clipPath id={`${id}-lattice`}><rect x="9" y="9" width="82" height="122" rx="4" /></clipPath>
        <clipPath id={`${id}-clip`}><rect x="1.2" y="1.2" width="97.6" height="137.6" rx="8" /></clipPath>
        <linearGradient id={`${id}-sheen`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopOpacity="0" className="[stop-color:var(--color-background)]" />
          <stop offset=".5" stopOpacity=".6" className="[stop-color:var(--color-background)]" />
          <stop offset="1" stopOpacity="0" className="[stop-color:var(--color-background)]" />
        </linearGradient>
      </defs>
      <rect className="fill-text stroke-text" strokeWidth="2.4" x="1.2" y="1.2" width="97.6" height="137.6" rx="8" />
      <g clipPath={`url(#${id}-lattice)`} className="fill-none stroke-background" strokeWidth="1.1" opacity=".4">
        {lines.map((line) => (
          <g key={line}>
            <path d={`M${-40 + line * 14} 0 L${60 + line * 14} 140`} />
            <path d={`M${140 - line * 14} 0 L${40 - line * 14} 140`} />
          </g>
        ))}
      </g>
      <rect className="fill-none stroke-background" strokeWidth="1.3" x="9" y="9" width="82" height="122" rx="4" />
      <rect className="fill-none stroke-background" strokeWidth=".8" opacity=".5" x="5.5" y="5.5" width="89" height="129" rx="6" />
      <ellipse className="fill-background" cx="50" cy="70" rx="24" ry="30" />
      <ellipse className="fill-none stroke-text" strokeWidth="1.4" cx="50" cy="70" rx="20.5" ry="26.5" />
      <path className="fill-text" d="M58,58 A13,13 0 1 0 58,82 A10,10 0 1 1 58,58Z" transform="translate(50 53) scale(.5) rotate(-12) translate(-53 -70)" />
      <text className={`fill-text ${serif}`} x="50" y="88" fontSize="24" textAnchor="middle">狂</text>
      <g clipPath={`url(#${id}-clip)`}>
        <g transform="skewX(-18)"><rect className="joker-sheen" x="-30" y="-10" width="34" height="170" fill={`url(#${id}-sheen)`} /></g>
      </g>
      <Sparks sparks={[{ x: 8, y: 10, scale: 0.8, delay: 0.3 }, { x: 92, y: 130, scale: 0.8, delay: 1.2 }, { x: 94, y: 30, scale: 0.6, delay: 2 }]} />
    </svg>
  );
}

export { JokerBack, JokerFace };
