import { Component, input } from '@angular/core';
import type { PixelFace } from '../domain/pixelFace';

/**
 * Renders a PixelFace (12×12, null = transparent) as crisp SVG squares —
 * an 8-bit portrait in the theme's stone frame.
 */
@Component({
  selector: 'app-pixel-avatar',
  styles: [
    `:host {
      display: block;
    }
    .pav {
      display: block;
      width: 100%;
      height: 100%;
      image-rendering: pixelated;
    }
    .pav--image {
      object-fit: cover;
      image-rendering: auto;
    }`,
  ],
  template: `
    @if (image()) {
      <img class="pav pav--image" [src]="image()" [alt]="label()" />
    } @else {
    <svg
      class="pav"
      viewBox="0 0 12 12"
      shape-rendering="crispEdges"
      role="img"
      [attr.aria-label]="label()"
    >
      @for (row of face(); let i = $index; track i) {
        @for (pixel of row; let j = $index; track j) {
          @if (pixel) {
            <rect [attr.x]="j" [attr.y]="i" width="1" height="1" [attr.fill]="pixel" />
          }
        }
      }
    </svg>
    }
  `,
})
export class PixelAvatar {
  readonly face = input.required<PixelFace>();
  readonly label = input('Portrait');
  readonly image = input<string | undefined>(undefined);
}