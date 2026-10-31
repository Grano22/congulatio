import { Injectable, inject } from '@angular/core';
import { Session } from './session';
import { firebaseFirestore } from './firebase';
import { cloudErrorMessage } from './authErrors';
import { ErrorLog } from '../store/errorLog';
import { NetworkStore } from '../store/networkStore';
import { REPOSITORY_URL } from '../layout/app-version';
import { ErrorEntry, ErrorReportPayload, buildPayload, coarseBrowser, issueUrl } from '../domain/errorReport';

export const ERROR_REPORTS = 'error_reports';
export const REPORT_RETENTION_DAYS = 365;

@Injectable({ providedIn: 'root' })
export class ErrorReporter {
  private readonly session = inject(Session);
  private readonly log = inject(ErrorLog);
  private readonly network = inject(NetworkStore);

  canSend(): boolean {
    return this.session.cloud() && this.network.online();
  }

  payload(entry: ErrorEntry, note: string): ErrorReportPayload {
    return buildPayload(entry, {
      browser: typeof navigator === 'undefined' ? 'Unknown browser' : coarseBrowser(navigator.userAgent),
      online: this.network.online(),
      note,
    });
  }

  async send(entry: ErrorEntry, note: string): Promise<string | null> {
    if (!this.canSend()) return 'Sign in and go online to send a report, or copy it instead.';
    try {
      const [db, sdk] = await Promise.all([firebaseFirestore(), import('firebase/firestore')]);
      await sdk.addDoc(sdk.collection(db, ERROR_REPORTS), {
        ...this.payload(entry, note),
        createdAt: sdk.serverTimestamp(),
        expireAt: sdk.Timestamp.fromMillis(Date.now() + REPORT_RETENTION_DAYS * 86_400_000),
      });
      this.log.markReported(entry.id);
      return null;
    } catch (e) {
      return cloudErrorMessage(e, 'The report could not be sent. You can copy it instead.');
    }
  }

  async copy(entry: ErrorEntry, note: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(JSON.stringify(this.payload(entry, note), null, 2));
      return true;
    } catch {
      return false;
    }
  }

  issueLink(entry: ErrorEntry, note: string): string {
    return issueUrl(REPOSITORY_URL, this.payload(entry, note));
  }
}
