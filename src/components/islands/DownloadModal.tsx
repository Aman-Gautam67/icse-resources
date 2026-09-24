import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, FileText, AlertCircle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import { resourceUrl } from '../../lib/resource-link.mjs';
import { safeArchiveUrl } from '../../lib/archive-url.mjs';
import type { LibraryFile } from '../../lib/resource-library';

export interface DownloadModalProps {
  file: LibraryFile | null;
  onClose: () => void;
}

type DownloadStep = 'trying_1' | 'started_1' | 'prompt_2' | 'trying_2' | 'started_2';

function triggerBrowserDownload(url: string) {
  if (!url) return;
  // Trigger download directly via a hidden iframe so the browser downloads the file without opening a new tab
  let iframe = document.getElementById('hidden-download-frame') as HTMLIFrameElement;
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'hidden-download-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0';
    iframe.style.border = 'none';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    document.body.appendChild(iframe);
  }
  iframe.src = url;
}

export default function DownloadModal({ file, onClose }: DownloadModalProps) {
  const [step, setStep] = useState<DownloadStep>('trying_1');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanName = file?.name?.replace(/\.(pdf|jpe?g|png|docx?|pptx?|xlsx?)$/i, '') || 'Resource';
  const hasServer2 = Boolean(file?.archiveUrl && safeArchiveUrl(file.archiveUrl));

  const startServer1 = useCallback(() => {
    if (!file) return;
    setStep('trying_1');
    const s1Url = resourceUrl(file, 'download');
    triggerBrowserDownload(s1Url);

    if (timerRef.current) clearTimeout(timerRef.current);
    // After brief connection handoff, show started status with optional Server 2 failover
    timerRef.current = setTimeout(() => {
      setStep('started_1');
    }, 1800);
  }, [file]);

  const startServer2 = useCallback(() => {
    if (!file) return;
    setStep('trying_2');
    if (timerRef.current) clearTimeout(timerRef.current);
    const s2Url = resourceUrl(file, 'download', '2');
    triggerBrowserDownload(s2Url);

    timerRef.current = setTimeout(() => {
      setStep('started_2');
    }, 1800);
  }, [file]);

  useEffect(() => {
    if (file) {
      startServer1();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [file, startServer1]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!file) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-dialog-title"
        className="fixed inset-x-4 top-[18%] sm:top-[22%] max-w-md mx-auto z-[130] rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in text-card-foreground"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Download size={18} aria-hidden="true" />
            </span>
            <h2 id="download-dialog-title" className="text-sm font-semibold text-foreground">
              Download Resource
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Close dialog"
            aria-label="Close download dialog"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* File Information (source/origin completely hidden) */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/40 border border-border/60 mb-5">
          <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{cleanName}</p>
            {file.path && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{file.path}</p>
            )}
          </div>
        </div>

        {/* Dynamic Status / Actions */}
        {step === 'trying_1' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-accent/40 border border-border/50 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Trying Server 1...</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Contacting Server 1 to start your download. Your download should begin automatically.
              </p>
            </div>
            {hasServer2 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={startServer2}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  Server 1 slow? Switch to Server 2
                </button>
              </div>
            )}
          </div>
        )}

        {step === 'started_1' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">
                Download Started from Server 1
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your file has been requested from Server 1. Check your browser's download manager or notifications.
              </p>
            </div>

            {hasServer2 && (
              <div className="p-3 rounded-xl bg-accent/30 border border-border/60 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">File didn't download?</p>
                  <p className="text-[11px] text-muted-foreground">Try Server 2 for an alternate connection</p>
                </div>
                <button
                  type="button"
                  onClick={startServer2}
                  className="px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium text-xs transition-colors shrink-0 cursor-pointer"
                >
                  Try Server 2
                </button>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={startServer1}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw size={12} aria-hidden="true" />
                <span>Re-download</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center py-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {step === 'prompt_2' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 gap-2">
              <AlertCircle className="h-6 w-6 text-amber-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">
                Download taking longer than expected?
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {hasServer2
                  ? 'If your download did not start automatically from Server 1, you can switch to Server 2.'
                  : 'Server 1 might be busy. Would you like to retry the download?'}
              </p>
            </div>
            <div className="space-y-2 pt-1">
              {hasServer2 ? (
                <>
                  <button
                    type="button"
                    onClick={startServer2}
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                  >
                    <Download size={16} aria-hidden="true" />
                    <span>Try Server 2</span>
                  </button>
                  <button
                    type="button"
                    onClick={startServer1}
                    className="inline-flex items-center justify-center gap-2 w-full py-2 px-4 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent font-medium text-xs transition-colors cursor-pointer"
                  >
                    <RefreshCw size={13} aria-hidden="true" />
                    <span>Retry Server 1</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startServer1}
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
                >
                  <RefreshCw size={15} aria-hidden="true" />
                  <span>Retry Server 1</span>
                </button>
              )}
            </div>
          </div>
        )}

        {step === 'trying_2' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-accent/40 border border-border/50 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Trying Server 2...</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Connecting to Server 2 and starting your download...
              </p>
            </div>
          </div>
        )}

        {step === 'started_2' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 gap-2">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">
                Download Started from Server 2
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your file has been dispatched from Server 2. Check your browser's download manager or notifications.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={startServer2}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-medium transition-colors cursor-pointer"
              >
                <RefreshCw size={12} aria-hidden="true" />
                <span>Re-download</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 inline-flex items-center justify-center py-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
