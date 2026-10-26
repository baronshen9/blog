export type DomainErrorCode =
  "NOT_FOUND" | "VALIDATION" | "CONFLICT" | "UNAUTHORIZED";

// An expected failure of a service; the message is safe to show to the caller.
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}
