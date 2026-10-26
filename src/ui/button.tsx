import styles from "./button.module.css";

export function Button({
  variant = "secondary",
  className,
  ...props
}: React.ComponentProps<"button"> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      className={[styles.button, styles[variant], className]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}
