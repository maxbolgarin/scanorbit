// App URL configuration
// In development: localhost:3000
// In production: app.scanorbit.io
export const appUrl = import.meta.env.DEV
  ? "http://localhost:3000"
  : "https://app.scanorbit.io";
