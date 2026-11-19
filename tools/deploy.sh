#!/bin/zsh
# Udruller backend til Apps Script med clasp og udgiver en ny version på den eksisterende web app
# (samme URL som i assets/config.js). Kræver .deploy/.clasp.json (scriptId – gitignored) og et clasp-login
# som ejeren af projektet: npx -y @google/clasp login --user rmu
#
#   tools/deploy.sh "Kort beskrivelse af ændringen"
#
# Filnavne i Apps Script: Kode (= apps-script/Code.gs), Core (= shared/core.js), Sortiment (= shared/sortiment.js).
# appsscript.json tages fra .deploy/appsscript.live.json (hentet med clasp pull), så indstillingerne live bevares.
set -euo pipefail
cd "$(dirname "$0")/.."
BESKRIVELSE="${1:-$(git log -1 --format=%s)}"
DEPLOY_ID=$(grep -o 'AKfycb[A-Za-z0-9_-]*' assets/config.js | head -1)
[ -n "$DEPLOY_ID" ] || { echo "Fandt ingen web app-id i assets/config.js"; exit 1; }
[ -f .deploy/.clasp.json ] || { echo "Mangler .deploy/.clasp.json"; exit 1; }

# Test først – ingen udrulning med fejlende test
UD=$(/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc shared/core.js tests/core.test.js)
echo "$UD" | tail -1
echo "$UD" | grep -q 'FEJL: 0$' || { echo "Testen fejler – udruller ikke."; exit 1; }

rm -rf .deploy/src && mkdir -p .deploy/src
cp apps-script/Code.gs .deploy/src/Kode.js
cp shared/core.js .deploy/src/Core.js
cp shared/sortiment.js .deploy/src/Sortiment.js
cp .deploy/appsscript.live.json .deploy/src/appsscript.json

cd .deploy
npx -y @google/clasp push --force --user rmu 2>&1 | grep -v 'npm warn'
npx -y @google/clasp deploy --deploymentId "$DEPLOY_ID" --description "$BESKRIVELSE" --user rmu 2>&1 | grep -v 'npm warn'
