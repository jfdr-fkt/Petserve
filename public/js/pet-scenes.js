// Local vector artwork: no network requests or large animation dependencies.
const dog =
  () => `<g class="pet-dog" stroke="#604d41" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path class="pet-tail" d="M36 77Q4 50 12 29Q22 32 26 48L49 65" fill="#dfaa70"/>
  <g class="pet-leg pet-leg-back"><path d="M62 96L56 129Q57 135 70 133L82 99" fill="#dfaa70"/></g>
  <g class="pet-leg pet-leg-front"><path d="M115 94L113 130Q115 135 128 132L139 96" fill="#dfaa70"/></g>
  <path d="M38 77Q39 52 69 56L132 61Q150 72 143 98Q99 116 51 99Q38 95 38 77" fill="#efc895"/>
  <path d="M94 87Q111 74 142 83L137 99Q113 109 95 102" fill="#fff8ec" stroke="none"/>
  <g class="pet-leg pet-leg-near-back"><path d="M54 96L50 130Q50 138 66 134L76 98" fill="#efc895"/></g>
  <g class="pet-leg pet-leg-near-front"><path d="M124 94L127 130Q129 138 145 133L146 95" fill="#efc895"/></g>
  <path d="M130 67L161 73L166 62L135 57Z" fill="#4477a0" stroke="#315f86"/>
  <circle cx="154" cy="74" r="6" fill="#f1c866" stroke="#ae812f"/>
  <g class="pet-head">
    <path d="M130 59Q120 24 146 14Q181 1 197 28L204 45Q227 43 227 57Q224 74 199 77Q157 84 137 69Z" fill="#efc895"/>
    <path d="M151 18Q124 14 127 37L137 62Q146 69 156 53L166 29" fill="#c58e58"/>
    <path d="M191 47Q202 42 221 49L224 62Q211 79 184 68Q174 58 191 47" fill="#fff8ec" stroke="none"/>
    <ellipse cx="222" cy="49" rx="8" ry="6" fill="#604d41" stroke="none"/>
    <path d="M182 38Q188 31 193 38M195 62Q202 69 211 60" fill="none"/>
    <path d="M203 65Q204 81 213 77L216 63" fill="#e39a95"/>
    <ellipse cx="177" cy="49" rx="7" ry="4" fill="#eab39b" stroke="none"/>
  </g>
</g>`;

const cat =
  () => `<g class="pet-cat" stroke="#405b71" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
  <path class="pet-tail" d="M29 70Q-1 46 9 20Q14 10 24 13Q31 17 25 25Q15 41 42 59" fill="#a4bdd4"/>
  <g class="pet-leg pet-leg-back"><path d="M48 84L44 115Q45 122 57 118L66 85" fill="#a4bdd4"/></g>
  <g class="pet-leg pet-leg-front"><path d="M92 84L94 117Q96 122 108 118L111 83" fill="#a4bdd4"/></g>
  <path d="M29 70Q29 46 55 45L99 45Q120 48 115 83Q86 104 42 90Q28 85 29 70" fill="#b9cede"/>
  <g class="pet-leg pet-leg-near-back"><path d="M40 85L36 116Q36 123 51 118L60 86" fill="#b9cede"/></g>
  <g class="pet-leg pet-leg-near-front"><path d="M99 82L108 115Q111 124 123 117L118 78" fill="#b9cede"/></g>
  <path d="M100 54L132 58L137 49L105 44Z" fill="#f1c866" stroke="#ae812f"/>
  <g class="pet-head">
    <path d="M99 46L97 8L118 19Q133 13 148 20L168 9L167 44Q173 71 137 72Q105 68 99 46" fill="#b9cede"/>
    <path d="M103 18L114 24L105 30M154 26L163 19L161 33" fill="#e4aca8" stroke="none"/>
    <path d="M113 43Q119 36 124 43M146 43Q151 36 157 43" fill="none"/>
    <path d="M130 49L140 49L135 54Z" fill="#c58587" stroke="none"/>
    <path d="M135 54L135 59M125 58Q135 67 145 58M109 52L90 49M109 59L92 63M155 52L175 49M155 59L173 63" fill="none" stroke-width="2"/>
    <ellipse cx="113" cy="52" rx="6" ry="3" fill="#e4aca8" stroke="none"/>
    <ellipse cx="156" cy="52" rx="6" ry="3" fill="#e4aca8" stroke="none"/>
  </g>
</g>`;

export function petScene(kind = 'play') {
  if (kind === 'goodbye') return goodbyeScene();
  const running = kind === 'run';
  return `<svg class="pet-scene pet-scene-${kind}" viewBox="0 0 640 300" ${running ? 'aria-hidden="true"' : 'role="img" aria-label="A happy cartoon dog and cat playing together"'} xmlns="http://www.w3.org/2000/svg">
    <ellipse class="scene-halo" cx="320" cy="152" rx="280" ry="135"/>
    <circle cx="488" cy="65" r="28" fill="#f1c866"/>
    <g class="scene-cloud" fill="#fffefa"><path d="M83 77Q69 52 92 43Q107 24 125 44Q150 41 151 62Q156 78 137 78Z"/><path d="M342 53Q331 33 349 28Q365 13 379 29Q400 26 404 47Q403 57 387 57Z"/></g>
    <path class="scene-ground" d="M49 249Q182 235 313 248T589 245" fill="none" stroke-width="3" stroke-linecap="round"/>
    <g fill="#82a28d" stroke="#557d64" stroke-width="2"><path d="M63 249Q38 207 55 200Q75 205 70 236Q70 208 87 210Q95 225 76 249"/><path d="M562 247Q552 219 563 213Q574 219 571 237Q583 222 589 232Q592 242 579 247"/></g>
    <ellipse class="scene-shadow" cx="${running ? 145 : 225}" cy="249" rx="80" ry="8"/><ellipse class="scene-shadow" cx="${running ? 345 : 438}" cy="249" rx="61" ry="7"/>
    <g transform="translate(${running ? 20 : 105} 110)"><g class="scene-dog">${dog()}</g></g>
    <g transform="translate(${running ? 285 : 356} 127)"><g class="scene-cat">${cat()}</g></g>
    ${running ? '<g class="scene-speed" fill="none" stroke="#799bbd" stroke-width="3" stroke-linecap="round"><path d="M80 179H31M81 190H51M300 203H273"/></g>' : '<g class="scene-ball"><circle cx="320" cy="230" r="15" fill="#f1c866" stroke="#ae812f" stroke-width="2"/><path d="M306 225Q325 226 329 242M309 240Q318 222 334 226" fill="none" stroke="#fff8ec" stroke-width="3"/></g><g class="scene-butterfly" transform="translate(330 86)"><path d="M0 0Q-19-22-22-4Q-19 10 0 3Q20-16 23-2Q22 12 0 3" fill="#e4aca8"/><path d="M0 0L0 9" stroke="#604d41" stroke-width="2"/></g>'}
  </svg>`;
}

function goodbyeScene() {
  return `<svg class="pet-scene pet-scene-goodbye" viewBox="0 0 640 320" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <ellipse class="scene-goodbye-halo" cx="320" cy="170" rx="275" ry="139"/>
    <g stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <rect class="scene-house" x="398" y="139" width="185" height="142" rx="12"/>
      <path class="scene-roof" d="M374 146L488 56L607 146Z"/>
      <rect class="scene-door" x="493" y="195" width="57" height="86" rx="16"/>
      <circle cx="537" cy="241" r="4" fill="#f1c866" stroke="none"/>
      <rect class="scene-window" x="421" y="177" width="44" height="40" rx="9"/>
      <path class="scene-window-lines" d="M443 178V216M422 197H464"/>
    </g>
    <path class="scene-ground" d="M42 283Q209 270 330 282T603 283" fill="none" stroke-width="3" stroke-linecap="round"/>
    <ellipse class="scene-shadow" cx="188" cy="279" rx="79" ry="7"/>
    <ellipse class="scene-shadow" cx="400" cy="283" rx="64" ry="7"/>
    <g transform="translate(70 143)"><g class="scene-dog">${dog()}</g></g>
    <g transform="translate(315 159)"><g class="scene-cat">${cat()}</g></g>
    <g class="scene-goodbye-heart scene-goodbye-heart-dog" transform="translate(241 92)"><path d="M0 5C-21-11-32 8-17 21L0 35L17 21C32 8 21-11 0 5Z" fill="#dc9b98"/></g>
    <g class="scene-goodbye-heart scene-goodbye-heart-cat" transform="translate(361 62)"><path d="M0 5C-16-8-25 7-13 17L0 28L13 17C25 7 16-8 0 5Z" fill="#e9b779"/></g>
    <g fill="#82a28d" stroke="#557d64" stroke-width="2"><path d="M60 284Q39 255 53 248Q67 253 65 275Q77 260 85 269Q86 280 73 285"/><path d="M589 284Q575 257 588 251Q600 260 596 278"/></g>
  </svg>`;
}
