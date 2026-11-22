#!/bin/sh
# Publica a pasta dist no branch gh-pages (GitHub Pages)
set -e
npm run build
cd dist
touch .nojekyll
git init -q -b gh-pages
git add -A
git -c commit.gpgsign=false commit -q -m "deploy"
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push -f "$(cd .. && git remote get-url origin)" gh-pages
rm -rf .git
