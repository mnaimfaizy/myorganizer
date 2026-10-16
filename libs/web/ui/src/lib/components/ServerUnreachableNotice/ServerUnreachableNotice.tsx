import * as React from 'react';
import { WifiOff } from 'lucide-react';

import { cn } from '../../utils';
import { Button } from '../Button/Button';
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../Card/Card';

export interface ServerUnreachableNoticeProps {
  /** Called when the User asks to try the connection again. */
  onRetry: () => void;
  /** True while a retry is in flight: the button is disabled and marked busy. */
  retrying?: boolean;
  /** Additional CSS classes merged onto the full-viewport wrapper. */
  className?: string;
}

/**
 * Full-viewport panel shown when the server cannot be reached and the session
 * is kept on this device. It offers no sign-in path: the session is not gone,
 * so the User is asked to wait or retry rather than log in again.
 */
const ServerUnreachableNotice = React.forwardRef<
  HTMLDivElement,
  ServerUnreachableNoticeProps
>(({ onRetry, retrying = false, className }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(
      'flex min-h-screen items-center justify-center p-4',
      className,
    )}
  >
    <Card className="w-full max-w-md text-center">
      <CardHeader className="items-center">
        <WifiOff className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <CardTitle className="text-xl">Can&apos;t reach the server</CardTitle>
        <CardDescription>
          Your session is kept on this device. We&apos;ll try again
          automatically when your connection returns.
        </CardDescription>
      </CardHeader>
      <CardFooter className="justify-center">
        <Button onClick={onRetry} disabled={retrying} aria-busy={retrying}>
          Try again
        </Button>
      </CardFooter>
    </Card>
  </div>
));
ServerUnreachableNotice.displayName = 'ServerUnreachableNotice';

export { ServerUnreachableNotice };
