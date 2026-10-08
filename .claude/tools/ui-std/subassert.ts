const j = JSON.parse(await Bun.stdin.text()); const bad: string[] = [];
for (const [w, v] of Object.entries<any>(j)) for (const b of v.bad) bad.push(`${w}: ${b}`);
console.log(bad.length ? 'FAIL ' + bad.join('; ') : 'PASS'); process.exit(bad.length ? 1 : 0);
