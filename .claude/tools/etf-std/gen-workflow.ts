/// <reference types="bun" />
// usage: bun gen-workflow.ts spec.json > .github/workflows/update-data.yml
// spec: { name, slug, commitTitle, inputs: [{name, description}],
//         protectedVars?: { CONTROL: "REPO_VARIABLE_NAME" },   // e.g. { SEC_UA: "SEC_UA", AUDIENCE_TYPE: "INVESCO_AUDIENCE_TYPE" }; nonblank repo variable wins over everything
//         requiredControls?: ["SEC_UA"],                      // fail if the resolved control is blank
//         extraAdd?: ["scripts/some-state-file"] }            // extra paths staged next to api/<slug> (state written by the updater)
// `inputs` = INDIVIDUAL inputs (lowercase control names); `advanced` is appended automatically; total must be <= 25.
import { readFileSync } from 'node:fs';
const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (s.inputs.length > 24) throw new Error(`max 24 individual inputs + advanced, got ${s.inputs.length}`);
const q = (v: string) => JSON.stringify(v);
const inputs = s.inputs.map((i: any) => `      ${i.name}:\n        description: ${q(`${i.description}; blank inherits scripts/update-data.config.json`)}\n        required: false\n        default: ""\n        type: string`).join('\n');
const pv: Record<string, string> = s.protectedVars ?? {};
const envBlock = [`          DISPATCH_INPUTS: \${{ toJSON(inputs) }}`, ...Object.entries(pv).map(([c, v]) => `          PROTECTED_${c}: \${{ vars.${v} }}`)].join('\n');
const protectedLines = `
            // Protected repository Actions variables: highest precedence, applied only when nonblank (never printed).
            const protectedVars = {};${Object.keys(pv).map((c) => `
            if ((process.env.PROTECTED_${c} ?? "").trim()) protectedVars.${c} = process.env.PROTECTED_${c}.trim();`).join('')}`;
const required = (s.requiredControls ?? []).map((c: string) => `
            if (!String(controls.${c} ?? "").trim()) { console.error("${c} is required: set the repository Actions variable or the config default"); process.exit(1); }`).join('');
const add = [`api/${s.slug}`, ...(s.extraAdd ?? [])].join(' ');
console.log(`name: ${s.name}

on:
  schedule:
    - cron: '0 0 * * 0'
  workflow_dispatch:
    inputs:
${inputs}
      advanced:
        description: 'JSON object of supported control overrides not exposed above (keys are UPPER_CASE control names, values are scalars); nonblank individual inputs win'
        required: false
        default: '{}'
        type: string

permissions:
  contents: write

concurrency:
  group: update-data
  cancel-in-progress: false

jobs:
  update-data:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          persist-credentials: false
      - name: Setup bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest
      - name: Install dependencies
        run: bun install --frozen-lockfile
      - name: Run updater unit tests
        run: bun test
      - name: Resolve file defaults and manual overrides
        env:
${envBlock}
        run: |
          bun --eval '
            import { resolveControls } from "./scripts/update-data.ts";
            import { appendFile } from "node:fs/promises";
            // schedule runs have no dispatch inputs: file defaults apply as-is
            const inputs = JSON.parse(process.env.DISPATCH_INPUTS || "{}") || {};
            const advanced = JSON.parse(inputs.advanced || "{}");
            const individual = Object.fromEntries(Object.entries(inputs)
              .filter(([key]) => key !== "advanced")
              .map(([key, value]) => [key.toUpperCase(), value]));
            const file = await Bun.file("scripts/update-data.config.json").json();${protectedLines}
            const controls = resolveControls(file, advanced, individual, protectedVars);${required}
            await appendFile(process.env.GITHUB_ENV,
              Object.entries(controls).map(([key, value]) => \`\${key}=\${value}\\n\`).join(""));
          '
      - name: Generate api/${s.slug} static data
        run: bun ./scripts/update-data.ts
      - name: Commit updated data
        if: \${{ !cancelled() }}
        env:
          GITHUB_TOKEN: \${{ github.token }}
        run: |
          git add ${add}
          if git diff --cached --quiet -- ${add}; then
            echo "api/${s.slug} is already up to date"
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "chore(data): ${s.commitTitle}"
          # Runtime-only auth; no token/header stored in URL, file or Git config.
          push() { git -c credential.helper= -c credential.helper='!f() { if test "$1" = get; then printf "username=x-access-token\\npassword=%s\\n" "$GITHUB_TOKEN"; fi; }; f' push; }
          # main may have moved while the updater ran (merges, other pushes): rebase the data commit and retry
          for attempt in 1 2 3 4; do
            push && exit 0
            echo "push rejected: rebasing onto origin/\${GITHUB_REF_NAME} (attempt \${attempt})"
            git pull --rebase origin "\${GITHUB_REF_NAME}" || exit 1
          done
          exit 1`);
