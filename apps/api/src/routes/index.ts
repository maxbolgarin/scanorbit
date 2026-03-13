import { Hono } from 'hono';
import authRoute from './auth.js';
import orgsRoute from './orgs.js';
import awsAccountsRoute from './aws-accounts.js';
import awsScansRoute from './aws-scans.js';
import resourcesRoute from './resources.js';
import findingsRoute from './findings.js';
import gdprRoute from './gdpr.js';
import stripeRoute from './stripe.js';
import newsletterRoute from './newsletter.js';
import webhooksRoute from './webhooks.js';
import publicApiRoute from './publicApi.js';
import type { Variables } from '../types/index.js';

const routes = new Hono<{ Variables: Variables }>();

// Mount routes with prefixes
routes.route('/auth', authRoute);
routes.route('/orgs', orgsRoute);
routes.route('/aws/accounts', awsAccountsRoute);
routes.route('/aws/scans', awsScansRoute);
routes.route('/resources', resourcesRoute);
routes.route('/findings', findingsRoute);

// GDPR compliance routes (data export, deletion requests, audit logs)
routes.route('/gdpr', gdprRoute);

// Stripe payment routes
routes.route('/stripe', stripeRoute);

// Newsletter subscription (public)
routes.route('/newsletter', newsletterRoute);

// Webhook bridges (Scaleway bounce → Listmonk)
routes.route('/webhooks', webhooksRoute);

// Public API v1 (API key authentication)
routes.route('/api/v1', publicApiRoute);

export default routes;
