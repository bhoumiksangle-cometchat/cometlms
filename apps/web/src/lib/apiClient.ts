import axios, { AxiosInstance, AxiosError } from 'axios';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    const envUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL);
    // Empty string means same-origin (requests go to current host, Nginx proxies /api)
    const baseURL = envUrl !== undefined && envUrl !== null ? envUrl : 'http://localhost:3000';

    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    // Add response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - clear auth
          this.setToken(null);
          localStorage.removeItem('accessToken');
          if (typeof window !== 'undefined') {
            localStorage.removeItem('refreshToken');
          }
        }
        return Promise.reject(error);
      },
    );

  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  // Auth endpoints
  async register(email: string, password: string, name: string, role?: 'STUDENT' | 'INSTRUCTOR') {
    const response = await this.client.post<ApiResponse<{ user: any; tokens: { accessToken: string; refreshToken: string } }>>('/api/auth/register', {
      email,
      password,
      name,
      role,
    });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post<ApiResponse<{ user: any; tokens: { accessToken: string; refreshToken: string } }>>('/api/auth/login', {
      email,
      password,
    });
    return response.data;
  }

  async logout() {
    const response = await this.client.post<ApiResponse>('/api/auth/logout');
    return response.data;
  }

  async getMe() {
    const response = await this.client.get<ApiResponse<any>>('/api/auth/me');
    return response.data;
  }

  async refreshToken(refreshToken: string) {
    const response = await this.client.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/api/auth/refresh', {
      refreshToken,
    });
    return response.data;
  }

  // Chat endpoints
  async getRoomMessages(roomId: string, limit?: number) {
    const response = await this.client.get<ApiResponse<any[]>>(`/api/chat/rooms/${roomId}/messages`, {
      params: { limit },
    });
    return response.data;
  }

  async sendMessage(roomId: string, content: string, parentMessageId?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/api/chat/rooms/${roomId}/messages`, {
      content,
      parentMessageId,
    });
    return response.data;
  }

  async getConversations() {
    const response = await this.client.get<ApiResponse<any[]>>('/api/chat/conversations');
    return response.data;
  }

  async createDirectMessage(userId: string) {
    return this.post(`/api/chat/dm/${userId}`);
  }

  async createRoom(roomId: string, name: string, type?: 'GROUP' | 'DM') {
    const response = await this.client.post<ApiResponse<any>>('/api/chat/rooms', {
      roomId,
      name,
      type,
    });
    return response.data;
  }

  async addRoomMember(roomId: string, userId: string, role?: string) {
    const response = await this.client.post<ApiResponse<any>>(`/api/chat/rooms/${roomId}/members`, {
      userId,
      role,
    });
    return response.data;
  }

  async removeRoomMember(roomId: string, userId: string) {
    const response = await this.client.delete<ApiResponse<any>>(`/api/chat/rooms/${roomId}/members/${userId}`);
    return response.data;
  }

  // Courses endpoints
  async getCourses(search?: string) {
    const response = await this.client.get<ApiResponse<any[]>>('/api/courses', {
      params: { search },
    });
    return response.data;
  }

  async getCourse(id: string) {
    const response = await this.client.get<ApiResponse<any>>(`/api/courses/${id}`);
    return response.data;
  }

  async createCourse(data: any) {
    const response = await this.client.post<ApiResponse<any>>('/api/courses', data);
    return response.data;
  }

  // Generic request methods
  async get<T = any>(path: string, config?: any) {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }

  async post<T = any>(path: string, data?: any, config?: any) {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }

  async patch<T = any>(path: string, data?: any, config?: any) {
    const response = await this.client.patch<T>(path, data, config);
    return response.data;
  }

  async delete<T = any>(path: string, config?: any) {
    const response = await this.client.delete<T>(path, config);
    return response.data;
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

export default apiClient;
