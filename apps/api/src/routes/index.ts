import { Hono } from 'hono';
import authRoute from './auth.js';
import orgsRoute from './orgs.js';
import awsAccountsRoute from './aws-accounts.js';
import awsScansRoute from './aws-scans.js';
import resourcesRoute from './resources.js';
import findingsRoute from './findings.js';
import bugReportsRoute from './bug-reports.js';
import integrationsRoute from './integrations.js';
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

// Bug reports
routes.route('/bug-reports', bugReportsRoute);

// Outgoing webhooks / integrations
routes.route('/integrations', integrationsRoute);

// Public API v1 (API key authentication)
routes.route('/api/v1', publicApiRoute);

export default routes;
