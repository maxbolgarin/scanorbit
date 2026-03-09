import { coreAuthMethods } from './core.js';
import { verificationMethods } from './verification.js';
import { passwordMethods } from './password.js';
import { googleOAuthMethods } from './googleOAuth.js';
import { githubOAuthMethods } from './githubOAuth.js';
import { oauthSharedMethods } from './oauthShared.js';

export const authService = {
  ...coreAuthMethods,
  ...verificationMethods,
  ...passwordMethods,
  ...googleOAuthMethods,
  ...githubOAuthMethods,
  ...oauthSharedMethods,
};
