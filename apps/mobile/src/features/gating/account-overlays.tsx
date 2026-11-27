import { useEffect } from 'react';
import { View } from 'react-native';

import { Snackbar } from '../../components/ui/snackbar';
import { useToast } from '../../lib/toast';
import { SignedOutSheet } from '../account/session-ended';
import { AuthGateSheet } from './auth-gate-sheet';
import { useAccountOverlays } from './use-account-overlays';

const TOAST_MS = 4_000;

function ToastHost() {
  const { message, hide } = useToast();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [message, hide]);
  if (!message) return null;
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 bottom-20">
      <Snackbar message={message} onDismiss={hide} />
    </View>
  );
}

// Mounted once at the root, above every screen.
export function AccountOverlays() {
  const { gate, signedOut } = useAccountOverlays();
  return (
    <>
      <AuthGateSheet view={gate} />
      <SignedOutSheet view={signedOut} />
      <ToastHost />
    </>
  );
}
