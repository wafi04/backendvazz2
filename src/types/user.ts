export type User = {
  id: number; 
  name: string | null;
  username: string;
  role: string;
  whatsapp: string | null;
  balance: number;
  apiKey: string | null;
  otp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
    lastPaymentAt: string | null;

};

export interface RegisterInput {
  name: string;
  username: string;
  whatsapp: number | undefined
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface UserResponse {
  id: number;
  name: string;
  username: string;
  createdAt: Date;
  balance?: number;
  role: string;
  apiKey?: string | null;
}

export interface AuthResponse {
  message: string;
  user: UserResponse;
  token?: string;
}