import { apiClient } from './api';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  roles: string[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

class AuthService {
  async getCurrentUser(): Promise<User> {
    // Auth routes are at /api/auth, not /api/v1/auth
    const token = this.getAccessToken();
    const response = await axios.get<User>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  }

  async logout(): Promise<void> {
    // Auth routes are at /api/auth, not /api/v1/auth
    const token = this.getAccessToken();
    await axios.post('/api/auth/logout', {}, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>('/auth/refresh', { refresh_token: refreshToken });
  }

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  isAuthenticated(): boolean {
    // Check for admin bypass first
    const adminUser = localStorage.getItem('litemaas_admin_user');
    if (adminUser) {
      return true;
    }
    
    return !!this.getAccessToken();
  }
}

export const authService = new AuthService();
