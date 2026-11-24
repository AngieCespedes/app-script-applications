#!/usr/bin/env bash
# Publica una app: revisa calidad, sube el código y (opcional) mueve el despliegue web a una versión nueva.
#
#   scripts/publicar.sh <app> push                 → solo sube el código (HEAD). Ojo: menús y barras de la hoja usan HEAD.
#   scripts/publicar.sh <app> release "<nota>"     → sube, crea versión y actualiza el despliegue web (la URL no cambia).
#
# Requiere `clasp login` hecho una vez en este equipo con la cuenta DUEÑA del script.
set -euo pipefail

APP="${1:?Falta la app (carpeta dentro de apps/)}"
MODO="${2:?Falta el modo: push o release}"
NOTA="${3:-}"
DIR="apps/$APP"
[ -f "$DIR/.clasp.json" ] || { echo "No existe $DIR/.clasp.json"; exit 1; }

if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin commit. Publique solo código versionado."; exit 1
fi

npm run check
COMMIT="$(git rev-parse --short HEAD)"

cd "$DIR"
npx clasp push --force

if [ "$MODO" = "release" ]; then
  [ -n "$NOTA" ] || { echo "Un release necesita una nota."; exit 1; }
  DESC="$NOTA · commit $COMMIT"
  VERSION="$(npx clasp create-version "$DESC" | grep -oE '[0-9]+' | tail -1)"
  ID="$(npx clasp list-deployments | grep -v '@HEAD' | grep -oE 'AKfy[A-Za-z0-9_-]+' | head -1 || true)"
  if [ -n "$ID" ]; then
    npx clasp update-deployment "$ID" -V "$VERSION" -d "$DESC"
  else
    npx clasp create-deployment -V "$VERSION" -d "$DESC"
  fi
  cd - >/dev/null
  git tag -a "$APP-v$VERSION" -m "$DESC"
  echo "Listo: versión $VERSION desplegada y etiquetada $APP-v$VERSION. Haga git push --tags."
fi
