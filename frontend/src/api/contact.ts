import apiClient from "./client";

export type ContactPublicPayload = {
  email: string;
  name?: string;
  message: string;
};

export type ContactPublicResponse = {
  success: boolean;
  message: string;
};

export async function submitPublicContact(
  payload: ContactPublicPayload
): Promise<ContactPublicResponse> {
  const res = await apiClient.post<ContactPublicResponse>(
    "/contact/public",
    {
      email: payload.email.trim(),
      name: payload.name?.trim() || undefined,
      message: payload.message.trim(),
    },
    { skipGlobalErrorModal: true }
  );
  return res.data;
}
