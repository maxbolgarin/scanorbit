// App URL configuration
// In development: localhost:3000
// In production: app.scanorbit.cloud
const baseUrl = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://app.scanorbit.cloud";

export const signupUrl = `${baseUrl}/signup`;
export const loginUrl = `${baseUrl}/login`;
