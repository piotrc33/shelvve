import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RatingPicker } from './rating-picker';

@Component({
  imports: [RatingPicker],
  template: `<app-rating-picker [(rating)]="rating" />`,
})
class Host {
  readonly rating = signal<number | undefined>(undefined);
}

describe('RatingPicker', () => {
  function setup(initialRating?: number) {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.rating.set(initialRating);
    fixture.detectChanges();
    const button = (value: number) =>
      Array.from(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((b) => b.textContent?.trim() === String(value))!;
    return { fixture, host: fixture.componentInstance, button };
  }

  it('shows the scale 1 to 10', () => {
    const { fixture } = setup();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b) =>
      (b as HTMLButtonElement).textContent?.trim(),
    );
    expect(labels).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  });

  it('sets the rating on tap', () => {
    const { host, button } = setup();

    button(7).click();

    expect(host.rating()).toBe(7);
  });

  it('clears the rating when the current value is tapped again', () => {
    const { host, button } = setup(7);

    button(7).click();

    expect(host.rating()).toBeUndefined();
  });

  it('fills the buttons up to the rating and marks the chosen one as pressed', async () => {
    const { fixture, button } = setup(3);
    await fixture.whenStable();

    expect([1, 2, 3].every((value) => button(value).classList.contains('filled'))).toBe(true);
    expect(button(4).classList.contains('filled')).toBe(false);
    expect(button(3).getAttribute('aria-pressed')).toBe('true');
    expect(button(2).getAttribute('aria-pressed')).toBe('false');
  });
});
