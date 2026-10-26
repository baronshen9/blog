import Link from "next/link";
import styles from "./button.module.css";

type Variant = { variant?: "primary" | "secondary" };

function classes(variant: "primary" | "secondary", className?: string) {
  return [styles.button, styles[variant], className].filter(Boolean).join(" ");
}

export function Button({
  variant = "secondary",
  className,
  ...props
}: React.ComponentProps<"button"> & Variant) {
  return <button className={classes(variant, className)} {...props} />;
}

// A link that looks like a button, for actions that open another page.
export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: React.ComponentProps<typeof Link> & Variant) {
  return <Link className={classes(variant, className)} {...props} />;
}
