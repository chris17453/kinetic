import axios from 'axios';

const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || 'http://localhost:5000/api') + '/auth',
  headers: { 'Content-Type': 'application/json' },
});

export interface ForgotPasswordResponse {
  message: string;
  resetUrl?: string;
}

export interface ResetPasswordResponse {
  message: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  const { data } = await api.post<ForgotPasswordResponse>('/forgot-password', { email });
  return data;
}

export async function resetPassword(email: string, token: string, newPassword: string): Promise<ResetPasswordResponse> {
  const { data } = await api.post<ResetPasswordResponse>('/reset-password', { email, token, newPassword });
  return data;
}
