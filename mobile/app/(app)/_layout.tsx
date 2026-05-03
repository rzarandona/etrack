import { Stack } from 'expo-router';
import { useAutoSync } from '@/lib/use-auto-sync';

export default function AppLayout() {
  // Drains the pending queue whenever connectivity returns or on mount.
  useAutoSync();

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'etrack' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan badge' }} />
      <Stack.Screen name="confirm" options={{ title: 'Confirm scan', presentation: 'modal' }} />
      <Stack.Screen name="pending" options={{ title: 'Pending sync' }} />
      <Stack.Screen name="advances" options={{ title: 'My advances' }} />
      <Stack.Screen name="violations" options={{ title: 'My violations' }} />
      <Stack.Screen name="event/[id]" options={{ title: 'Event' }} />
      <Stack.Screen
        name="event/[id]/clock-in"
        options={{ title: 'Clock in/out', presentation: 'modal' }}
      />
    </Stack>
  );
}
