import type { ReactElement, TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

/**
 * Shared multiline text input primitive.
 *
 * @param props Textarea properties.
 * @returns Textarea element.
 */
export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>): ReactElement {
  return <textarea className={cn("ui-textarea", className)} {...props} />;
}
