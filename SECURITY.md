# Security Policy

RuleBlast is supposed to stay on your machine.

If something in the package, the CLI, or a receipt looks like it left that boundary, send the smallest safe report — not a public exploit thread. RuleBlast is a local, read-only repository debugger. Its supported product boundary excludes hosted services, model calls, telemetry, repository mutation, and executable profile extensions. Security reports should focus on behavior that crosses that boundary, unsafe package or command execution, path confinement, dependency provenance, receipt integrity, or disclosure of repository contents.

## Reporting a vulnerability

The latest published `1.3.x` release is the supported line. A source commit, signed tag, npm version, and GitHub Release are separate facts; verify each external record before relying on a version label.

Private vulnerability reporting is enabled for this repository. Submit confidential reports through `https://github.com/Kpoiut/ruleblast/security/advisories/new`; GitHub keeps the report private while maintainers triage it.

This route was verified through the repository setting and GitHub API on 2026-08-14. If GitHub does not show the private form, do not place sensitive details in another channel.

If no private channel is visible, open a minimal public issue that asks the maintainers to establish private contact. Do not include exploit details in a public issue, commit, pull request, fixture, receipt, or terminal capture.

Include the smallest safe reproduction, affected RuleBlast version or exact commit, operating system and Node.js version, expected boundary, and observed boundary. Redact credentials, private source contents, usernames, and absolute local paths.

Maintainers will acknowledge and investigate reports as capacity permits. There is no response-time or remediation-time guarantee. A fix is complete only when its regression test, package boundary, and applicable release evidence are independently verified.

## Supported versions

Registry, tag, and GitHub Release availability are external facts. Verify them before assigning a public version to a report. Before publication, cite the exact signed commit; after publication, cite the exact version returned by npm and the matching signed source tag.
