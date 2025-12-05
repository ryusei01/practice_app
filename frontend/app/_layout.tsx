import { Stack } from 'expo-router';
import { AuthProvider } from '../src/contexts/AuthContext';
import { LanguageProvider } from '../src/contexts/LanguageContext';
import '../src/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Home' }} />
          <Stack.Screen name="(auth)/login" options={{ title: 'Sign In' }} />
          <Stack.Screen name="(auth)/register" options={{ title: 'Sign Up' }} />
          <Stack.Screen name="(app)/question-sets/index" options={{ title: 'My Question Sets' }} />
          <Stack.Screen name="(app)/question-sets/create" options={{ title: 'Create Question Set' }} />
          <Stack.Screen name="(app)/question-sets/[id]" options={{ title: 'Question Set' }} />
          <Stack.Screen name="(app)/question-sets/[id]/add-question" options={{ title: 'Add Question' }} />
          <Stack.Screen name="(app)/quiz/[id]" options={{ title: 'Quiz' }} />
          <Stack.Screen name="(app)/ai-dashboard" options={{ title: 'AI Dashboard' }} />
          <Stack.Screen name="(app)/seller-dashboard" options={{ title: 'Seller Dashboard' }} />
          <Stack.Screen name="(app)/settings" options={{ title: 'Security Settings' }} />
          <Stack.Screen name="(app)/verify-otp" options={{ title: 'Verify OTP' }} />
        </Stack>
      </AuthProvider>
    </LanguageProvider>
  );
}
