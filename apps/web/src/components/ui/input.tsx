import type { InputHTMLAttributes, ReactElement } from "react";

import { cn } from "../../lib/utils";

/**
 * Shared text input primitive.
 *
 * @param props Input properties.
 * @returns Input element.
 */
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>): ReactElement {
  return <input className={cn("ui-input", className)} {...props} />;
}
