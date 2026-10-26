import { signOutAction } from "./actions";
import { requireOwner } from "./session";

export default async function AdminPage() {
  const owner = await requireOwner();
  return (
    <main>
      <h1>Admin</h1>
      <p>Signed in as {owner.username}.</p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
