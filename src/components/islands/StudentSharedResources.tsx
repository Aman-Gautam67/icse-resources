import { useEffect, useState } from 'react';

type SharedResource = { id: string; grade: number; subject: string; resourceType: string; fileName: string };

export default function StudentSharedResources() {
  const [grade, setGrade] = useState('10');
  const [resources, setResources] = useState<SharedResource[]>([]);
  useEffect(() => {
    const sync = () => setGrade(new URLSearchParams(location.search).get('class') === '12' ? '12' : '10');
    sync(); window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/submissions/approved?class=${grade}`, { signal: controller.signal })
      .then(response => response.ok ? response.json() : { resources: [] })
      .then(data => setResources(Array.isArray(data.resources) ? data.resources : []))
      .catch(() => setResources([]));
    return () => controller.abort();
  }, [grade]);
  if (!resources.length) return null;
  return <section className="mt-8 rounded-lg border border-border bg-card/70 p-5 sm:p-7" aria-labelledby="student-shares-title">
    <p className="text-xs font-semibold tracking-widest text-muted-foreground">FROM STUDENTS</p>
    <h2 id="student-shares-title" className="mt-2 text-2xl font-semibold">Student shared resources</h2>
    <p className="mt-2 text-sm text-muted-foreground">Approved Class {grade} papers, notes and images.</p>
    <ul className="mt-5 divide-y divide-border">
      {resources.map(item => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
        <div className="min-w-0"><strong className="block break-words font-semibold">{item.fileName}</strong><span className="text-muted-foreground">{item.subject} · {item.resourceType}</span></div>
        <a className="shrink-0 rounded-md border border-border px-3 py-2 font-medium text-primary hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={`/api/submissions/file?id=${encodeURIComponent(item.id)}`}>Download</a>
      </li>)}
    </ul>
  </section>;
}
