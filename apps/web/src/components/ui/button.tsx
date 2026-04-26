import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactElement } from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva("ui-button", {
  defaultVariants: {
    size: "default",
    variant: "default"
  },
  variants: {
    size: {
      default: "ui-button--default-size",
      icon: "ui-button--icon-size",
      small: "ui-button--small-size"
    },
    variant: {
      default: "ui-button--default",
      destructive: "ui-button--destructive",
      ghost: "ui-button--ghost",
      outline: "ui-button--outline",
      secondary: "ui-button--secondary"
    }
  }
});

/**
 * Shared button primitive based on the shadcn/ui variant pattern.
 *
 * @property asChild Render the button through a Radix slot.
 */
interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  readonly asChild?: boolean;
}

/**
 * Renders a styled button or slotted child.
 *
 * @param props Button properties.
 * @returns Button element.
 */
export function Button({
  asChild = false,
  className,
  size,
  type = "button",
  variant,
  ...props
}: ButtonProps): ReactElement {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      className={cn(buttonVariants({ size, variant }), className)}
      type={asChild ? undefined : type}
      {...props}
    />
  );
}
