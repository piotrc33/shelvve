import { Component, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { filter, map } from 'rxjs';

/**
 * Offers a reload when the service worker has downloaded a new version.
 * Without it an installed app keeps running the old version until it's closed and reopened.
 */
@Component({
  selector: 'app-update-banner',
  template: `
    @if (newVersionReady()) {
      <div class="banner" role="status">
        Jest nowa wersja Shelvve.
        <button type="button" (click)="reload()">Odśwież</button>
      </div>
    }
  `,
  styleUrl: './update-banner.scss',
})
export class UpdateBanner {
  private readonly swUpdate = inject(SwUpdate);

  protected readonly newVersionReady = toSignal(
    this.swUpdate.versionUpdates.pipe(
      filter((event) => event.type === 'VERSION_READY'),
      map(() => true),
    ),
    { initialValue: false },
  );

  constructor() {
    // The service worker checks for updates only when the app starts; an installed app often just comes back from
    // the background, so check then too.
    const checkWhenVisible = () => {
      if (document.visibilityState === 'visible' && this.swUpdate.isEnabled) {
        this.swUpdate.checkForUpdate().catch(() => undefined); // offline: try again next time
      }
    };
    document.addEventListener('visibilitychange', checkWhenVisible);
    inject(DestroyRef).onDestroy(() =>
      document.removeEventListener('visibilitychange', checkWhenVisible),
    );
  }

  protected reload(): void {
    document.location.reload();
  }
}
