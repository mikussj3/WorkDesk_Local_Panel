# GitHub repository setup checklist

1. Keep the English `README.md` in the repository root.
2. Keep `README_PL.md` next to it.
3. Add the production screenshot under `docs/images/` and reference it from both READMEs.
4. Replace badge version values when publishing a new release.
5. Ensure the open-source `LICENSE` (MIT License) file is included in the repository.
6. Enable GitHub private vulnerability reporting when available.
7. Do not commit real backups, email addresses or internal company URLs.
8. Replace example links in `src/runtime/shared/00-bootstrap-data.js` before public release, or convert them to clearly fictional examples.
9. Publish release assets together:
   - `index_KF64.html`
   - `index_KF64_DIAG.html`
   - source-dev ZIP
   - changelog
   - SHA-256 file
10. Require successful build/check/smoke verification before tagging a release.
