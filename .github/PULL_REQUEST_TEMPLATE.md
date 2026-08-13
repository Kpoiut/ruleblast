## What changed

Describe one defensible correction, regression, hardening step, or evidence update.

## Evidence

- [ ] I added the failing behavior test first and observed the intended failure.
- [ ] Public repository evidence uses immutable commit refs and a retrieval date.
- [ ] Resolver claims cite an official evidence URL and exact revision or retrieval date.
- [ ] The change preserves uncertainty instead of forcing an unknown state clean.
- [ ] No private source contents, credentials, or local absolute paths are included.

## Product boundary

- [ ] This keeps exactly four semantic actions and adds no hosted service, model call, telemetry, mutation, auto-fix, or executable profile extension.
- [ ] Vendor-specific loading logic remains inside its profile adapter.
- [ ] Every changed production module remains under 400 lines or has a documented extraction review.

## Verification

- [ ] Focused tests pass.
- [ ] `npm run check`
- [ ] `npm run build`
- [ ] `git diff --check`

If any item is not applicable, explain why in the pull request instead of silently deleting it.
