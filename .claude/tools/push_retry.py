#!/usr/bin/env python3
"""Replace the final push line of .github/workflows/update-data.yml (and the generator template) with a rebase-and-retry push."""
import sys, re
OLD_COMMENT = "          # Runtime-only auth; no token/header stored in URL, file or Git config.\n"
PUSH = "          git -c credential.helper= -c credential.helper='!f() { if test \"$1\" = get; then printf \"username=x-access-token\\npassword=%s\\n\" \"$GITHUB_TOKEN\"; fi; }; f' push\n"
NEW = (OLD_COMMENT +
"          push() { " + PUSH.strip().replace("          ","") + "; }\n"
"          # main may have moved while the updater ran (merges, other pushes): rebase the data commit and retry\n"
"          for attempt in 1 2 3 4; do\n"
"            push && exit 0\n"
"            echo \"push rejected: rebasing onto origin/${GITHUB_REF_NAME} (attempt ${attempt})\"\n"
"            git pull --rebase origin \"${GITHUB_REF_NAME}\" || exit 1\n"
"          done\n"
"          exit 1\n")
p = sys.argv[1]; t = open(p).read()
if "git pull --rebase" in t: print("already patched"); sys.exit(0)
old = OLD_COMMENT + PUSH
if old not in t: print("PATTERN NOT FOUND", p); sys.exit(1)
open(p, 'w').write(t.replace(old, NEW, 1)); print("patched", p)
