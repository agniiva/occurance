@echo off
cd /d C:\Users\Administrator\occurance-fix

REM Close the wrong PR
gh pr close 1

REM Merge the fix into main on oreo-agi/occurance
git checkout main
git merge fix/hugo-build-errors --no-edit
git push origin main

REM Create cross-fork PR from oreo-agi:main to agniiva:main
gh pr create --repo agniiva/occurance --title "fix: resolve Hugo build errors for Netlify deployment" --body "Fixes Hugo build failing on Netlify. Changes: replaced deprecated paginate with pagination.pagerSize (removed in Hugo v0.128+), fixed disableKinds to use taxonomy/term instead of categories/tags, removed deprecated keys (preserveTaxonomyNames, pygmentsCodeFences, pygmentsUseClasses, footnotereturnlinkcontents), replaced deprecated minify:true with minify.minifyOutput, removed junk file content/saas-3o, added .gitignore, removed 8 committed .DS_Store files. Tested: clean Hugo build with 0 warnings, 0 errors, 15 pages." --base main --head oreo-agi:main
