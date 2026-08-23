const CANDIDATE_ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*(@[1-9][0-9]*)?$/u;

export function isCandidateIdShape(value: string): boolean {
  return CANDIDATE_ID_PATTERN.exec(value)?.[0] === value;
}
