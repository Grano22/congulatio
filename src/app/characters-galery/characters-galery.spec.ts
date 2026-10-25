import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CharactersGalery } from './characters-galery';

describe('CharactersGalery', () => {
  let component: CharactersGalery;
  let fixture: ComponentFixture<CharactersGalery>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharactersGalery],
    }).compileComponents();

    fixture = TestBed.createComponent(CharactersGalery);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
