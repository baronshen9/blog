// Scoped to /admin: public pages and the API never receive the session.
export const sessionCookie = { name: "blog_session", path: "/admin" } as const;
