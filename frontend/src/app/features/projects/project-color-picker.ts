import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export const PROJECT_COLOR_OPTIONS = [
  { name: 'Orange', value: '#D87535' },
  { name: 'Burnt orange', value: '#B94F24' },
  { name: 'Amber', value: '#C38C32' },
  { name: 'Terracotta', value: '#C86D50' },
  { name: 'Olive', value: '#78834C' },
  { name: 'Sage', value: '#56836A' },
  { name: 'Teal', value: '#3F7F87' },
  { name: 'Ocean blue', value: '#4D7395' },
  { name: 'Indigo', value: '#5F66A6' },
  { name: 'Plum', value: '#8A608D' },
  { name: 'Rose', value: '#B65C6B' },
  { name: 'Slate', value: '#65717C' },
] as const;

@Component({
  selector: 'app-project-color-picker',
  imports: [CommonModule, FormsModule],
  templateUrl: './project-color-picker.html',
  styleUrl: './project-color-picker.scss',
})
export class ProjectColorPicker {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  @Input({ required: true }) color!: string;
  @Input() label = 'Project color';
  @Input() displayLabel = 'Project color';
  @Input() compact = false;
  @Input() floatingPopover = false;
  @Input() disabled = false;
  @Output() pickedColor = new EventEmitter<string>();

  readonly isOpen = signal(false);
  readonly colorOptions = PROJECT_COLOR_OPTIONS;
  private floatingPopoverElement: HTMLElement | null = null;

  ngOnDestroy(): void {
    this.floatingPopoverElement?.remove();
    this.floatingPopoverElement = null;
  }

  togglePicker(): void {
    if (!this.disabled) {
      const opening = !this.isOpen();
      this.isOpen.set(opening);
      if (opening && this.floatingPopover) {
        requestAnimationFrame(() => this.movePopoverToViewport());
      }
    }
  }

  selectColor(color: string): void {
    if (this.disabled) {
      return;
    }
    this.pickedColor.emit(color.toUpperCase());
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (
      target instanceof Node &&
      !this.elementRef.nativeElement.contains(target) &&
      !this.floatingPopoverElement?.contains(target)
    ) {
      this.isOpen.set(false);
      this.floatingPopoverElement?.remove();
      this.floatingPopoverElement = null;
    }
  }

  private movePopoverToViewport(): void {
    if (!this.isOpen() || !this.floatingPopover) {
      return;
    }
    const popover = this.elementRef.nativeElement.querySelector(
      '.color-popover',
    ) as HTMLElement | null;
    if (!popover) {
      return;
    }
    this.floatingPopoverElement = popover;
    document.body.append(popover);
  }
}
