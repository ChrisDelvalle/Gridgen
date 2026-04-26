import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

/**
 * Sheet root primitive.
 */
export const Sheet = DialogPrimitive.Root;

/**
 * Renders the sheet content portal.
 *
 * @param props Sheet content properties.
 * @returns Sheet content element.
 */
export function SheetContent({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-sheet-overlay" />
      <DialogPrimitive.Content className={cn("ui-sheet-content", className)} {...props}>
        {children}
        <DialogPrimitive.Close asChild>
          <Button aria-label="Close" className="ui-sheet-close" size="icon" variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Renders a sheet title.
 *
 * @param props Title properties.
 * @returns Title element.
 */
export function SheetTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): ReactElement {
  return <DialogPrimitive.Title className={cn("ui-sheet-title", className)} {...props} />;
}

/**
 * Renders sheet description text.
 *
 * @param props Description properties.
 * @returns Description element.
 */
export function SheetDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description className={cn("ui-sheet-description", className)} {...props} />
  );
}
