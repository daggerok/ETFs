// reads pcheck JSON from stdin, prints FAIL lines, exit 1 on failure
const j = JSON.parse(await Bun.stdin.text()); const bad: string[] = [];
for (const w of [1500, 1024, 390]) {
  const t = j[w].top, s = j[w].scrolled;
  if (t.header) bad.push(`${w}: header still exists`);
  if (!t.nav || !t.toolbar || !t.title || !t.count || !t.theme) { bad.push(`${w}: missing element`); continue; }
  if (!(t.toolbar[1] >= t.nav[3])) bad.push(`${w}: toolbar not below nav`);
  if (!(t.title[2] <= t.count[0])) bad.push(`${w}: title not left of count`);
  if (!(t.count[2] <= t.theme[0] && t.theme[2] <= t.nav[2])) bad.push(`${w}: count/theme order or overflow`);
  if (t.hscroll > 0) bad.push(`${w}: horizontal scroll ${t.hscroll}`);
  if (w >= 1024) {
    if (t.nav[1] !== 32) bad.push(`${w}: nav top ${t.nav[1]} != 32`);
    if (t.footer && t.footer[3] !== t.innerH) bad.push(`${w}: footer bottom ${t.footer[3]} != ${t.innerH}`);
    if (t.docH > t.innerH) bad.push(`${w}: page scrolls ${t.docH - t.innerH}`);
  } else {
    if (s.scrollY > 0 && s.nav[1] !== 0) bad.push(`${w}: nav not sticky (top ${s.nav[1]} at scrollY ${s.scrollY})`);
  }
}
if (j.errors.length) bad.push('console errors ' + j.errors.length);
console.log(bad.length ? 'FAIL ' + bad.join('; ') : 'PASS'); process.exit(bad.length ? 1 : 0);
