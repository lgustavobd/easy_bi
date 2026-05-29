import { http } from './http';

export async function login(email: string, password: string) {
  return (await http.post('/auth/login', { email, password })).data;
}

export async function me() {
  return (await http.get('/auth/me')).data;
}

export async function changePassword(payload: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return (await http.post('/auth/change-password', payload)).data;
}
