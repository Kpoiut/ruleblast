# Security Policy

RuleBlast is a local, read-only repository debugger. Its supported product boundary excludes hosted services, model calls, telemetry, repository mutation, and executable profile extensions. Security reports should focus on behavior that crosses that boundary, unsafe package or command execution, path confinement, dependency provenance, receipt integrity, or disclosure of repository contents.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when that option is visibly available in this repository's **Security** tab. Repository text does not prove that an external GitHub setting is enabled.

If no private channel is visible, open a minimal public issue that asks the maintainers to establish private contact. Do not include exploit details in a public issue, commit, pull request, fixture, receipt, or terminal capture.

Include the smallest safe reproduction, affected RuleBlast version or exact commit, operating system and Node.js version, expected boundary, and observed boundary. Redact credentials, private source contents, usernames, and absolute local paths.

Maintainers will acknowledge and investigate reports as capacity permits. There is no response-time or remediation-time guarantee. A fix is complete only when its regression test, package boundary, and applicable release evidence are independently verified.

## Supported versions

Registry, tag, and GitHub Release availability are external facts. Verify them before assigning a public version to a report. Before publication, cite the exact signed commit; after publication, cite the exact version returned by npm and the matching signed source tag.
