'use client';

import { Fragment } from 'react';
import { useToast } from '../../hooks/use-toast';
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './../Toast/Toast';

export function Toaster() {
  const { toasts } = useToast();

  // Chromium reuses a replaced Toast.Root portal into a stable viewport node; remount the
  // toast list and viewport together so the portal target is new, while ToastProvider stays
  // mounted (#810).
  return (
    <ToastProvider>
      <Fragment key={toasts[0]?.id ?? 'empty'}>
        {toasts.map(function ({ id, title, description, action, ...props }) {
          return (
            <Toast key={id} {...props}>
              <div className="grid gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose />
            </Toast>
          );
        })}
        <ToastViewport />
      </Fragment>
    </ToastProvider>
  );
}
