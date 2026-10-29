import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AssigneePicker } from './assignee-picker';

describe('AssigneePicker', () => {
  let fixture: ComponentFixture<AssigneePicker>;
  let component: AssigneePicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssigneePicker],
    }).compileComponents();
    fixture = TestBed.createComponent(AssigneePicker);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('filters suggestions and excludes assignees already selected', () => {
    component.assignees = ['Alice'];
    component.suggestions = ['Alice', 'Alina', 'Bob'];
    component.inputValue = 'ali';
    component.suggestionsOpen = true;
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.assignee-suggestions button',
    ) as NodeListOf<HTMLButtonElement>;
    const suggestions = Array.from(buttons).map((button) =>
      button.textContent?.trim(),
    );
    expect(suggestions).toEqual(['Add “ali”', 'Alina']);
  });

  it('adds multiple typed names and avoids case-insensitive duplicates', () => {
    const changes: string[][] = [];
    component.assignees = ['Alice'];
    component.assigneesChange.subscribe((assignees) => changes.push(assignees));
    component.inputValue = 'alice, Bob';

    component.addTypedAssignees();

    expect(changes).toEqual([['Alice', 'Bob']]);
    expect(component.inputValue).toBe('');
  });

  it('adds a predictive suggestion', () => {
    const changes: string[][] = [];
    component.suggestions = ['Alex'];
    component.assigneesChange.subscribe((assignees) => changes.push(assignees));

    component.addSuggestion('Alex');

    expect(changes).toEqual([['Alex']]);
  });

  it('renders selected assignees below the entry field', () => {
    component.assignees = ['Joti'];
    fixture.detectChanges();

    const picker = fixture.nativeElement.querySelector(
      '.assignee-picker',
    ) as HTMLElement;
    const children = Array.from(picker.children);
    const entryIndex = children.findIndex((child) =>
      child.classList.contains('assignee-entry'),
    );
    const chipsIndex = children.findIndex((child) =>
      child.classList.contains('assignee-chips'),
    );

    expect(entryIndex).toBeGreaterThanOrEqual(0);
    expect(chipsIndex).toBeGreaterThan(entryIndex);
  });
});
