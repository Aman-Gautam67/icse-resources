import type { APIRoute } from 'astro';
import catalog from '../../public/data/resource-catalog.json';
import { flattenCatalog } from '../lib/resource-catalog.mjs';
import { createResourceHandler } from '../lib/resource-fallback.mjs';

export const prerender = false;
const files = Object.values(catalog.classes).flatMap(sections => Object.values(sections).flatMap(section => flattenCatalog(section)));
const handle = createResourceHandler(files);
export const GET: APIRoute = ({ url }) => handle(url);
