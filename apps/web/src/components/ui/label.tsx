import * as LabelPrimitive from "@radix-ui/react-label";
import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../../lib/utils";

/**
 * Shared accessible label primitive.
 *
 * @param props Label properties.
 * @returns Label element.
 */
export function Label({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof LabelPrimitive.Root>): ReactElement {
  return <LabelPrimitive.Root className={cn("ui-label", className)} {...props} />;
}
