import { Redirect } from "expo-router";

export default function VerifyOtpRedirect() {
  return <Redirect href="/(auth)/login" />;
}
