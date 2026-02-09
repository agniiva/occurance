@echo off
cd /d C:\Users\Administrator\occurance-fix
git add netlify.toml
git commit -m "add netlify.toml with HUGO_VERSION to fix deploy preview"
git push origin main
