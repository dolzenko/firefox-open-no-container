#!/usr/bin/env sh
set -eu

extension_dir=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
artifacts_dir="${extension_dir}/web-ext-artifacts"
install_xpi="${HOME}/.local/share/firefox-open-no-container.xpi"

: "${WEB_EXT_API_KEY:?Set WEB_EXT_API_KEY to the AMO JWT issuer}"
: "${WEB_EXT_API_SECRET:?Set WEB_EXT_API_SECRET to the AMO JWT secret}"

rm -rf "$artifacts_dir"
mkdir -p "$artifacts_dir"

web-ext lint \
  --source-dir "$extension_dir" \
  --ignore-files "web-ext-artifacts" ".amo-upload-uuid" "README.md" "LICENSE" "amo-metadata.json" "sign-unlisted.sh" "tests"

web-ext sign \
  --source-dir "$extension_dir" \
  --artifacts-dir "$artifacts_dir" \
  --channel unlisted \
  --approval-timeout 900000 \
  --no-input \
  --ignore-files "web-ext-artifacts" ".amo-upload-uuid" "README.md" "LICENSE" "amo-metadata.json" "sign-unlisted.sh" "tests"

signed_xpi=$(find "$artifacts_dir" -maxdepth 1 -type f -name '*.xpi' | sort | tail -n 1)
if [ -z "$signed_xpi" ]; then
  echo "web-ext sign finished but no signed XPI was found in $artifacts_dir" >&2
  exit 1
fi

cp "$signed_xpi" "$install_xpi"
printf 'Signed XPI: %s\n' "$signed_xpi"
printf 'Install copy: %s\n' "$install_xpi"
