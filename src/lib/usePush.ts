"use client";

import { useCallback, useEffect, useState } from "react";
import type { Profile, PushStatus, WebPushSubscription } from "@/lib/types";
import {
  apiErrorMessage,
  getPushStatus,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/api/client";
import {
  iosNeedsInstall,
  registerServiceWorker,
  serviceWorkerSupported,
  urlBase64ToUint8Array,
} from "@/lib/pwa";

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return apiErrorMessage(error);
}

/**
 * Manages this browser's Web Push subscription for the active profile.
 * Background reminders still require a server cron job; this hook only handles
 * permission, registration, and syncing the subscription with MongoDB.
 */
export function usePush(profile: Profile | null) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSent, setTestSent] = useState<number | null>(null);
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);

  const refresh = useCallback(async () => {
    if (!profile) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await getPushStatus(profile.id);
      setStatus(next);

      const canPush = serviceWorkerSupported();
      setSupported(canPush);
      if (canPush) {
        const registration = await registerServiceWorker();
        const subscription = registration
          ? await registration.pushManager.getSubscription()
          : null;
        setSubscribed(Boolean(subscription) && next.subscriptions > 0);
      } else {
        setSubscribed(false);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    setNeedsInstall(iosNeedsInstall());
    void refresh();
  }, [refresh]);

  const subscribe = useCallback(async () => {
    if (!profile || busy) return false;
    setBusy(true);
    setError(null);
    setTestSent(null);

    try {
      if (!serviceWorkerSupported()) {
        throw new Error(
          "This browser does not support background notifications."
        );
      }
      if (iosNeedsInstall()) {
        throw new Error(
          "On iPhone or iPad, add this app to the Home Screen first, then enable reminders from there."
        );
      }

      // Must happen directly in the click handler, before slower awaits.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error(
          "Notifications are blocked. Allow them in your browser settings and try again."
        );
      }

      let current = status;
      if (!current?.enabled || !current.publicKey) {
        current = await getPushStatus(profile.id);
        setStatus(current);
      }
      if (!current.enabled || !current.publicKey) {
        throw new Error(
          "Background reminders are not configured on the server yet."
        );
      }

      const registration = await registerServiceWorker();
      if (!registration) {
        throw new Error("The service worker could not be registered.");
      }

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            current.publicKey
          ) as BufferSource,
        });
      }

      await subscribeToPush(
        profile.id,
        subscription.toJSON() as WebPushSubscription
      );
      setSubscribed(true);
      const latest = await getPushStatus(profile.id);
      setStatus(latest);
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [profile, busy, status]);

  const unsubscribe = useCallback(async () => {
    if (!profile || busy) return false;
    setBusy(true);
    setError(null);
    setTestSent(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribeFromPush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
      setStatus((current) =>
        current ? { ...current, subscriptions: 0 } : current
      );
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [profile, busy]);

  const sendTest = useCallback(async () => {
    if (!profile || busy) return false;
    setBusy(true);
    setError(null);
    setTestSent(null);
    try {
      const sent = await sendTestPush(profile.id);
      setTestSent(sent);
      return true;
    } catch (err) {
      setError(errorText(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [profile, busy]);

  return {
    status,
    subscribed,
    loading,
    busy,
    error,
    testSent,
    supported,
    needsInstall,
    refresh,
    subscribe,
    unsubscribe,
    sendTest,
  };
}
