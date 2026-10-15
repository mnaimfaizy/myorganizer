'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@myorganiser/web-ui';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useYouTubeAcknowledgement } from '../hooks';
import { YOUTUBE_DATA_PRIVACY_BULLETS } from '../lib/dataPrivacyCopy';

interface YouTubeConnectPromptProps {
  /**
   * Optional connect handler. If provided, the button will call it instead of
   * navigating. Used by YouTubePageClient to trigger the OAuth flow.
   */
  onConnect?: () => void;

  /**
   * Optional status message or variant. Used to show "revoked" state in
   * YouTubePageClient. Rendered as a note below the main text.
   */
  statusMessage?: React.ReactNode;

  /**
   * Optional fallback link destination when onConnect is not provided.
   * If not provided and onConnect is absent, defaults to "/dashboard/youtube".
   */
  fallbackHref?: string;
}

/**
 * What the User agrees to before a first connect (ADR 0129). Plain copy, in the
 * terms CONTEXT.md uses: YouTube Disconnect, Vault, Cached Upload, Watched.
 */
const ACKNOWLEDGEMENT_POINTS = [
  'MyOrganizer reads your YouTube subscriptions and the channel and upload details for the channels you enable. It only reads from YouTube, and it never stores video files.',
  'That data is stored outside your Vault and is not end-to-end encrypted. Your YouTube access tokens are encrypted at rest.',
  'Google will show an "unverified app" warning when you connect. MyOrganizer is run personally and has not been through Google\'s app verification.',
  'If you disconnect YouTube, or the operator withdraws your YouTube access, everything is deleted straight away: your followed channels, cached uploads, Watched marks, digest settings and tokens. Nothing is kept for a later reconnect.',
  'YouTube in MyOrganizer is run personally by its operator, who can switch it off.',
] as const;

const acknowledgementSchema = z.object({
  accepted: z.literal(true, {
    error: 'Tick the box to agree before connecting',
  }),
});

type AcknowledgementFormValues = z.infer<typeof acknowledgementSchema>;

interface YouTubeConnectPromptActionProps {
  onConnect: () => void;
}

/**
 * The connect action. It owns the acknowledgement lookup, so the Shorts
 * fallback (which renders no action) makes no acknowledgement request.
 *
 * Until the stored acknowledgement is known, Connect is disabled so a User who
 * has already accepted does not see the checkbox flash. A User who has not
 * accepted (or whose lookup failed; the server enforces it anyway) ticks the
 * box, and submitting stores the acknowledgement before connecting.
 */
function YouTubeConnectPromptAction({
  onConnect,
}: YouTubeConnectPromptActionProps) {
  const { acknowledged, loading, accept } = useYouTubeAcknowledgement();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<AcknowledgementFormValues>({
    resolver: zodResolver(acknowledgementSchema),
  });
  const { isSubmitting } = form.formState;
  const accepted = useWatch({ control: form.control, name: 'accepted' });

  const handleAcceptedChange = useCallback(
    (checked: boolean | 'indeterminate') => {
      if (checked === true) {
        form.setValue('accepted', true);
      } else {
        form.resetField('accepted');
      }
    },
    [form],
  );

  const handleAccept = useCallback(async () => {
    setSubmitError(null);
    try {
      await accept();
    } catch {
      setSubmitError('Could not save your acknowledgement. Please try again.');
      return;
    }
    onConnect();
  }, [accept, onConnect]);

  const submitErrorAlert = submitError ? (
    <p role="alert" className="text-sm text-destructive">
      {submitError}
    </p>
  ) : null;

  if (loading || acknowledged === true) {
    return (
      <>
        <Button onClick={onConnect} disabled={loading}>
          Connect YouTube
        </Button>
        {submitErrorAlert}
      </>
    );
  }

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleAccept)}
          className="flex w-full max-w-md flex-col gap-4"
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Before you connect</p>
            <ul className="list-disc list-inside space-y-1 text-left">
              {ACKNOWLEDGEMENT_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
          <FormField
            control={form.control}
            name="accepted"
            render={({ field }) => (
              <FormItem className="flex items-start gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={handleAcceptedChange}
                    disabled={isSubmitting}
                    ref={field.ref}
                  />
                </FormControl>
                <FormLabel className="cursor-pointer text-sm font-normal leading-relaxed">
                  I agree to the{' '}
                  <Link href="/privacy" className="underline">
                    Privacy Policy
                  </Link>{' '}
                  and to{' '}
                  <a
                    href="https://www.youtube.com/t/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    YouTube&apos;s Terms of Service
                  </a>
                  .
                </FormLabel>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={!accepted || isSubmitting}>
            Connect YouTube
          </Button>
        </form>
      </Form>
      {submitErrorAlert}
    </>
  );
}

/**
 * Shared connect prompt shown when YouTube is not connected.
 *
 * Used by both YouTubePageClient (with onConnect callback and status message)
 * and ShortsPageClient (without onConnect, linking back to /dashboard/youtube).
 *
 * The YouTube SVG icon, layout, and messaging are consistent across both.
 */
export function YouTubeConnectPrompt({
  onConnect,
  statusMessage,
  fallbackHref = '/dashboard/youtube',
}: YouTubeConnectPromptProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <div className="rounded-full bg-destructive/10 p-4">
        <svg
          viewBox="0 0 24 24"
          className="h-12 w-12 text-destructive"
          fill="currentColor"
        >
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        Connect Your YouTube Account
      </h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        Link your YouTube account to view and manage videos from your Enabled
        Channels. We only request read-only access.
      </p>
      <div className="max-w-md text-center text-sm text-muted-foreground">
        <ul className="list-disc list-inside space-y-1 mb-2 inline-block text-left">
          {YOUTUBE_DATA_PRIVACY_BULLETS.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </div>
      <Link
        href="/youtube/data-privacy"
        className="text-xs underline text-muted-foreground"
      >
        How we store your YouTube data
      </Link>
      {statusMessage && <p className="text-sm text-warning">{statusMessage}</p>}
      {onConnect ? (
        <YouTubeConnectPromptAction onConnect={onConnect} />
      ) : (
        <Button asChild>
          <Link href={fallbackHref}>Back to Videos</Link>
        </Button>
      )}
    </div>
  );
}
