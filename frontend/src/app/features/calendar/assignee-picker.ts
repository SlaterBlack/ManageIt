import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAX_ASSIGNEES_LENGTH } from '../../core/models/task.model';

@Component({
  selector: 'app-assignee-picker',
  imports: [CommonModule, FormsModule],
  templateUrl: './assignee-picker.html',
  styleUrl: './assignee-picker.scss',
})
export class AssigneePicker {
  @Input() assignees: string[] = [];
  @Input() suggestions: string[] = [];
  @Input() inputName = 'assigneePickerInput';
  @Input() disabled = false;
  @Input() maxLength = MAX_ASSIGNEES_LENGTH;
  @Output() assigneesChange = new EventEmitter<string[]>();

  inputValue = '';
  suggestionsOpen = false;

  get filteredSuggestions(): string[] {
    const query = this.inputValue.split(',').at(-1)?.trim().toLocaleLowerCase() ?? '';
    return this.suggestions
      .filter(
        (suggestion) =>
          !this.isSelected(suggestion) &&
          (!query || suggestion.toLocaleLowerCase().includes(query)),
      )
      .slice(0, 8);
  }

  get canAddTypedAssignee(): boolean {
    const name = this.inputValue.split(',').at(-1)?.trim() ?? '';
    return Boolean(
      name &&
        !this.isSelected(name) &&
        !this.suggestions.some(
          (suggestion) =>
            suggestion.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ),
    );
  }

  get exceedsMaxLength(): boolean {
    return this.assignees.join(', ').length > this.maxLength;
  }

  addTypedAssignees(): void {
    this.addNames(this.inputValue.split(','));
    this.inputValue = '';
    this.suggestionsOpen = false;
  }

  addSuggestion(suggestion: string): void {
    const precedingNames = this.inputValue.split(',').slice(0, -1);
    this.addNames([...precedingNames, suggestion]);
    this.inputValue = '';
    this.suggestionsOpen = false;
  }

  removeAssignee(name: string): void {
    this.assigneesChange.emit(
      this.assignees.filter(
        (assignee) =>
          assignee.toLocaleLowerCase() !== name.toLocaleLowerCase(),
      ),
    );
  }

  handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTypedAssignees();
    }
  }

  handleBlur(): void {
    this.addTypedAssignees();
  }

  private addNames(names: string[]): void {
    const next = [...this.assignees];
    for (const name of names.map((value) => value.trim()).filter(Boolean)) {
      if (
        !next.some(
          (assignee) =>
            assignee.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      ) {
        next.push(name);
      }
    }
    if (next.length !== this.assignees.length) {
      this.assigneesChange.emit(next);
    }
  }

  private isSelected(name: string): boolean {
    return this.assignees.some(
      (assignee) => assignee.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  }
}
