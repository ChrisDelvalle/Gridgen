import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactElement } from "react";

import { cn } from "../../lib/utils";
import { Button } from "./button";

/**
 * Dialog root primitive.
 */
export const Dialog = DialogPrimitive.Root;

/**
 * Renders modal dialog content.
 *
 * @param props Dialog content properties.
 * @returns Dialog content element.
 */
export function DialogContent({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content>): ReactElement {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="ui-dialog-overlay" />
      <DialogPrimitive.Content className={cn("ui-dialog-content", className)} {...props}>
        {children}
        <DialogPrimitive.Close asChild>
          <Button aria-label="Close" className="ui-dialog-close" size="icon" variant="ghost">
            <X aria-hidden="true" size={18} />
          </Button>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Renders a dialog title.
 *
 * @param props Title properties.
 * @returns Title element.
 */
export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): ReactElement {
  return <DialogPrimitive.Title className={cn("ui-dialog-title", className)} {...props} />;
}

/**
 * Renders dialog description text.
 *
 * @param props Description properties.
 * @returns Description element.
 */
export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): ReactElement {
  return (
    <DialogPrimitive.Description className={cn("ui-dialog-description", className)} {...props} />
  );
}
