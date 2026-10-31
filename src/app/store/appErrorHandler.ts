import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ErrorLog } from './errorLog';

@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly log = inject(ErrorLog);

  handleError(error: unknown): void {
    console.error(error);
    this.log.capture(error);
  }
}
