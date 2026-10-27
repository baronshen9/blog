import { Button } from "./button";
import styles from "./token-table.module.css";

type TokenRow = {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

// The owner's API tokens with their creation and last use, never a secret.
// An active token has a Revoke button that submits its id to `revokeAction`;
// a revoked one shows when it was revoked.
export function TokenTable({
  tokens,
  revokeAction,
}: {
  tokens: TokenRow[];
  revokeAction: (form: FormData) => Promise<void>;
}) {
  if (tokens.length === 0) {
    return <p className={styles.empty}>No tokens yet.</p>;
  }
  return (
    <div className={styles.box}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Created</th>
            <th>Last used</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr
              key={token.id}
              className={token.revokedAt ? styles.revoked : undefined}
            >
              <td className={styles.name}>{token.name}</td>
              <td className={styles.time}>
                <Time value={token.createdAt} />
              </td>
              <td className={styles.time}>
                {token.lastUsedAt ? <Time value={token.lastUsedAt} /> : "Never"}
              </td>
              <td>
                {token.revokedAt ? (
                  <span className={styles.time}>
                    Revoked <Time value={token.revokedAt} />
                  </span>
                ) : (
                  <form action={revokeAction}>
                    <input type="hidden" name="id" value={token.id} />
                    <Button type="submit">Revoke</Button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A moment to the minute, in UTC like every admin date.
function Time({ value }: { value: Date }) {
  const iso = value.toISOString();
  return (
    <time dateTime={iso}>{`${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`}</time>
  );
}
