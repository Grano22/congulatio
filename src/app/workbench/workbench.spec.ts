import { TestBed } from '@angular/core/testing';
import { provideServiceWorker } from '@angular/service-worker';
import { Workbench } from './workbench';

describe('Workbench', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Workbench],
      providers: [provideServiceWorker('ngsw-worker.js', { enabled: false })],
    }).compileComponents();
  });

  it('should create the workbench', () => {
    const fixture = TestBed.createComponent(Workbench);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the forge title', async () => {
    const fixture = TestBed.createComponent(Workbench);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Congulatio');
  });
});