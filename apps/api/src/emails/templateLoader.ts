/**
 * Drip email template loader.
 * Reads HTML templates from disk, compiles with Handlebars, and caches.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, 'templates');

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

/**
 * Render a drip email template with the given data.
 * @param sequenceName - subdirectory name (e.g. 'free-scanned')
 * @param templateName - file stem (e.g. 'day0-results')
 * @param data - template variables (first_name, unsubscribe_url, etc.)
 */
export function renderTemplate(
  sequenceName: string,
  templateName: string,
  data: Record<string, unknown>,
): string {
  const key = `${sequenceName}/${templateName}`;

  if (!templateCache.has(key)) {
    const html = readFileSync(
      join(TEMPLATES_DIR, sequenceName, `${templateName}.html`),
      'utf-8',
    );
    templateCache.set(key, Handlebars.compile(html));
  }

  return templateCache.get(key)!(data);
}
