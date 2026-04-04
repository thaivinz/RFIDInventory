import { httpClient } from '@/lib/http/client';
import { AuthResponse, LoginCredentials } from '../types';

export const loginAuth = async (data: LoginCredentials): Promise<AuthResponse> => {
  const res = await httpClient<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Backend wrap response: { success: true, message: '...', data: { access_token, refresh_token, ... } }
  return res.data || res;
};
