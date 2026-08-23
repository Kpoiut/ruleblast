import { hostShellDialect, type ShellDialect } from "../render-format.js";

export interface HostProcess {
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly platform: string;
}

export function currentHostProcess(
  overrides: Partial<HostProcess> = {},
): HostProcess {
  return Object.freeze({
    cwd: overrides.cwd ?? process.cwd(),
    env: overrides.env ?? process.env,
    platform: overrides.platform ?? process.platform,
  });
}

export function hostProcessDialect(host: HostProcess): ShellDialect {
  return hostShellDialect(host.platform);
}

export function hostTextContext<T extends object>(
  host: HostProcess,
  fields: T,
): T & { readonly shellDialect: ShellDialect } {
  return { ...fields, shellDialect: hostProcessDialect(host) };
}
