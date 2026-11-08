import type { ButtonHTMLAttributes } from "react";

export function buttonClass(
  variant: "primary" | "secondary" | "ghost" = "primary",
) {
  return `button button--${variant}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant)} ${className}`}
      {...props}
    />
  );
}
