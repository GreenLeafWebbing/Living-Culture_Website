#!/usr/bin/env bash
# Builds dist/living-culture-wordpress.zip – the WordPress plugin version of the site.
# Upload it in WordPress: Plugins → Add New → Upload Plugin.
set -euo pipefail
cd "$(dirname "$0")/.."

out=dist
pkg="$out/living-culture"
rm -rf "$pkg" "$out/living-culture-wordpress.zip"
mkdir -p "$pkg/site"

cp wordpress/living-culture.php wordpress/readme.txt "$pkg/"
cp -r index.html admin.html bible.html assets css js "$pkg/site/"

(cd "$out" && zip -qr living-culture-wordpress.zip living-culture)
rm -rf "$pkg"
echo "Built $out/living-culture-wordpress.zip"
