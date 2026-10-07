export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ForgetPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ResendOtpInput {
  email: string;
}

/** Pulled from request headers/IP — passed into login/register flows. */
export interface LoginContext {
  ip?: string;
  userAgent?: string;
  browser?: string;
  os?: string;
  deviceId?: string;
}
