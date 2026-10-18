'use client';
import { useState } from 'react';
import type { SeoDocument } from '@/lib/seo-pages';
import styles from './AgentControlCentre.module.css';

export type WebSummary = { status: string; error?: string; checkedAt?: string; pages?: number; products?: number; totalProducts?: number; resources?: number; seoFindings?: number; maintenanceFindings?: number; coverage?: string };
export type MetadataSnapshot = { before?: { title?: string; description?: string; canonical?: string }; after?: { title?: string; description?: string; canonical?: string } };
export function MetadataPreview({ snapshot }: { snapshot?: MetadataSnapshot }) {
  if (!snapshot?.after) return null;
  return <div className={styles.comparison}>{(['before', 'after'] as const).map(version => <div key={version}><strong>{version === 'before' ? 'Live when checked' : 'Publish with your approval'}</strong><dl><dt>Title</dt><dd>{snapshot[version]?.title || 'Missing'}</dd><dt>Description</dt><dd>{snapshot[version]?.description || 'Missing'}</dd><dt>Canonical URL</dt><dd>{snapshot[version]?.canonical || 'Missing'}</dd></dl></div>)}</div>;
}
export default function WebAgentPanel({ summary, metadata, busy, restore }: { summary?: WebSummary; metadata: SeoDocument[]; busy: boolean; restore: (document: SeoDocument) => Promise<void> }) {
  const [confirmPath, setConfirmPath] = useState('');
  const approved = metadata.filter(doc => doc.title);
  return <section className={styles.webPanel} aria-labelledby="website-agents-title">
    <div className={styles.sectionHeading}><h3 id="website-agents-title">SEO & website maintenance</h3><span>{summary?.status === 'failed' ? 'Check incomplete' : summary ? 'Latest check recorded' : 'Ready for first check'}</span></div>
    {summary?.error && <p role="alert" className={styles.notice}>{summary.error}</p>}
    <div className={styles.webSummary}>
      <div><strong>SEO agent</strong><p>Checks search previews, canonical URLs, indexing directives, page headings and sampled product search data. Drafts metadata for your approval.</p><span>{summary?.seoFindings !== undefined ? `${summary.seoFindings} findings in the latest check` : 'No completed SEO check yet'}</span></div>
      <div><strong>Maintenance agent</strong><p>Checks public page responses, crawler files and a sample of linked resources. Records repair requests; code and infrastructure changes need review.</p><span>{summary?.maintenanceFindings !== undefined ? `${summary.maintenanceFindings} findings in the latest check` : 'No completed maintenance check yet'}</span></div>
    </div>
    <p className={styles.muted}>{summary?.pages !== undefined ? `Coverage: ${summary.pages} pages (${summary.products} of ${summary.totalProducts} products) and ${summary.resources} resources. ` : ''}{summary?.coverage || 'The daily check uses the existing schedule. Public page checks make no paid API calls.'}</p>
    <p className={styles.muted}>Automatic: checks, draft preparation and sitemap updates. Your approval: search text and canonical tags. Code, design, redirects, dependencies, purchases and paid services require a separately reviewed change.</p>
    {approved.length > 0 && <details className={styles.approved}><summary>Published SEO metadata · {approved.length}</summary>{approved.map(doc => <div key={doc.path}><strong>{doc.path} · {doc.title}</strong><p>{doc.description}</p>{confirmPath === doc.path ? <div><p>Restore this page’s original title and description and remove its approved canonical tag?</p><div className={styles.controls}><button type="button" disabled={busy} onClick={async () => { await restore(doc); setConfirmPath(''); }}>Confirm restore</button><button type="button" disabled={busy} onClick={() => setConfirmPath('')}>Cancel</button></div></div> : <button type="button" disabled={busy} onClick={() => setConfirmPath(doc.path)}>Restore original metadata…</button>}</div>)}</details>}
  </section>;
}
