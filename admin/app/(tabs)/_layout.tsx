import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      {/* Isso garante que nenhuma tela terá cabeçalho ou barra de abas vazando */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}