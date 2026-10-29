import { Injectable } from '@angular/core';
import { TaskStatus } from '../../core/models/task.model';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TASKS = 5000;
const MAX_SCHEDULE_DAYS = 365 * 50;
const DAY_MS = 86400000;

interface WorkInterval {
  start: number;
  end: number;
}

interface CalendarException {
  startDate: string;
  endDate: string;
  intervals: WorkInterval[];
}

interface WorkCalendar {
  weekdays: Map<number, WorkInterval[]>;
  exceptions: CalendarException[];
}

interface SourceDependency {
  predecessor: string;
  successor: string;
  type: string;
  lag: string;
}

interface SourceTask {
  sourceId: string;
  row: number;
  aliases: string[];
  name: string;
  assignee: string;
  startDate: string | null;
  dueDate: string | null;
  durationMinutes: number | null;
  calendarId: string;
  level: number;
  summary: boolean;
  isMilestone: boolean;
  progress: number;
  status: TaskStatus;
  parentReference: string;
  parentSourceId: string | null;
}

export interface GanttImportTask {
  sourceId: string;
  sourceRow: number;
  parentSourceId: string | null;
  name: string;
  assignee: string;
  startDate: string;
  dueDate: string;
  progress: number;
  status: TaskStatus;
  isMilestone: boolean;
}

export interface GanttImportDependency {
  predecessorSourceId: string;
  successorSourceId: string;
}

export interface GanttImportPreview {
  projectName: string;
  tasks: GanttImportTask[];
  dependencies: GanttImportDependency[];
  warnings: string[];
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class GanttImporter {
  async parseFile(file: File): Promise<GanttImportPreview> {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error('Choose an XML Gantt file smaller than 10 MB.');
    }
    if (file.name.split('.').at(-1)?.toLocaleLowerCase() !== 'xml') {
      throw new Error('Choose an XML export from GanttPRO or Microsoft Project.');
    }
    return parseGanttXml(await file.text());
  }
}

export function parseGanttXml(xmlText: string): GanttImportPreview {
  if (xmlText.length > MAX_FILE_BYTES) {
    throw new Error('Choose an XML Gantt file smaller than 10 MB.');
  }
  if (/<!DOCTYPE/i.test(xmlText)) {
    throw new Error('XML files containing a document type declaration are not supported.');
  }
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) {
    throw new Error('The selected file is not valid XML.');
  }
  const taskElements = Array.from(
    document.getElementsByTagNameNS('*', 'Task'),
  );
  if (!taskElements.length) {
    throw new Error('The XML does not contain any Gantt task records.');
  }
  if (taskElements.length > MAX_TASKS + 1) {
    throw new Error(`The import is limited to ${MAX_TASKS} tasks.`);
  }

  const warnings = new Set<string>();
  const errors: string[] = [];
  const projectTitle = textOf(document.documentElement, 'Title') || 'Imported Gantt';
  const minutesPerDay = positiveNumber(textOf(document.documentElement, 'MinutesPerDay'), 480);
  const minutesPerWeek = positiveNumber(
    textOf(document.documentElement, 'MinutesPerWeek'),
    minutesPerDay * 5,
  );
  const daysPerMonth = positiveNumber(
    textOf(document.documentElement, 'DaysPerMonth'),
    20,
  );
  const calendars = readCalendars(document, minutesPerDay);
  const defaultCalendarId = textOf(document.documentElement, 'CalendarUID');
  const resourceNames = readResourceNames(document);
  const assignments = readAssignments(document, resourceNames);
  const rawTasks: SourceTask[] = [];
  const seenIds = new Set<string>();
  const sourceDependencies: SourceDependency[] = [];

  for (const [index, element] of taskElements.entries()) {
    if (textOf(element, 'IsNull') === '1') {
      continue;
    }
    const row = index + 1;
    const name = textOf(element, 'Name');
    const uid = textOf(element, 'UID');
    const id = textOf(element, 'ID');
    const wbs = textOf(element, 'WBS');
    const outlineNumber = textOf(element, 'OutlineNumber');
    const sourceId = uid || id || wbs || outlineNumber || `task-${row}`;
    if (!name) {
      errors.push(`Task ${row}: the task name is missing.`);
      continue;
    }
    if (name.length > 120) {
      errors.push(`Task ${row}: task names must be 120 characters or fewer.`);
      continue;
    }
    if (seenIds.has(sourceId)) {
      errors.push(`Task ${row}: duplicate task identifier "${sourceId}".`);
      continue;
    }
    seenIds.add(sourceId);
    const startText =
      textOf(element, 'Start') || textOf(element, 'ActualStart');
    const finishText =
      textOf(element, 'Finish') || textOf(element, 'ActualFinish');
    const startDate = parseXmlDate(startText);
    const explicitDueDate = parseXmlDate(finishText);
    if (startText && !startDate) {
      errors.push(`Task ${row} "${name}": the start date could not be read.`);
    }
    if (finishText && !explicitDueDate) {
      errors.push(`Task ${row} "${name}": the finish date could not be read.`);
    }

    const durationText = textOf(element, 'Duration');
    const durationMinutes = parseDuration(
      durationText,
      minutesPerDay,
      minutesPerWeek,
      daysPerMonth,
    );
    if (durationText && durationMinutes === null) {
      errors.push(`Task ${row} "${name}": the duration could not be read.`);
    }
    const calendarId = textOf(element, 'CalendarUID') || defaultCalendarId;
    const calendar =
      calendars.get(calendarId) ?? calendars.values().next().value ?? defaultCalendar();
    let dueDate = explicitDueDate;
    if (!dueDate && startDate && durationMinutes !== null) {
      dueDate = finishDateFromDuration(startText, durationMinutes, calendar);
      if (!dueDate) {
        errors.push(
          `Task ${row} "${name}": its duration could not be scheduled on the project calendar.`,
        );
      }
    }
    if (!dueDate && startDate && durationMinutes === null) {
      dueDate = startDate;
      warnings.add(
        'Some tasks have no finish date or duration; their finish date defaults to their start date.',
      );
    }

    const progressValue = Number(textOf(element, 'PercentComplete') || 0);
    if (!Number.isFinite(progressValue) || progressValue < 0 || progressValue > 100) {
      errors.push(`Task ${row} "${name}": progress must be between 0 and 100.`);
    }
    const progress = Math.round(
      Number.isFinite(progressValue)
        ? Math.min(100, Math.max(0, progressValue))
        : 0,
    );
    const sourceStatus = normalize(textOf(element, 'Status'));
    const status: TaskStatus =
      ['complete', 'completed', 'done', 'closed'].includes(sourceStatus) ||
      progress === 100
        ? 'complete'
        : ['inprogress', 'active', 'started'].includes(sourceStatus) ||
            progress > 0
          ? 'in_progress'
          : 'not_started';
    const outlineLevel = Number(textOf(element, 'OutlineLevel'));
    const outlineNumberDepth = outlineNumber
      ? outlineNumber.split('.').length
      : wbs
        ? wbs.split('.').length
        : 1;
    const level =
      Number.isInteger(outlineLevel) && outlineLevel > 0
        ? Math.max(outlineLevel, outlineNumberDepth)
        : outlineNumberDepth;
    const aliases = [...new Set([sourceId, uid, id, wbs, outlineNumber].filter(Boolean))];
    rawTasks.push({
      sourceId,
      row,
      aliases,
      name,
      assignee: assignments.get(uid) ?? '',
      startDate,
      dueDate,
      durationMinutes,
      calendarId,
      level,
      summary: isTrue(textOf(element, 'Summary')),
      isMilestone: isTrue(textOf(element, 'Milestone')),
      progress,
      status,
      parentReference: textOf(element, 'ParentUID') || textOf(element, 'ParentID'),
      parentSourceId: null,
    });

    for (const predecessor of directChildren(element, 'PredecessorLink')) {
      const predecessorId =
        textOf(predecessor, 'PredecessorUID') ||
        textOf(predecessor, 'PredecessorID');
      if (predecessorId) {
        sourceDependencies.push({
          predecessor: predecessorId,
          successor: sourceId,
          type: textOf(predecessor, 'Type'),
          lag: textOf(predecessor, 'LinkLag'),
        });
      }
    }
    for (const predecessor of splitReferences(textOf(element, 'Predecessors'))) {
      sourceDependencies.push({
        predecessor,
        successor: sourceId,
        type: '',
        lag: '',
      });
    }
  }

  const aliasMap = new Map<string, SourceTask[]>();
  for (const task of rawTasks) {
    for (const alias of task.aliases) {
      const matches = aliasMap.get(alias) ?? [];
      matches.push(task);
      aliasMap.set(alias, matches);
    }
  }

  const topLevelTasks = rawTasks.filter((task) => task.level === 1);
  const projectWrapper =
    topLevelTasks.length === 1 &&
    topLevelTasks[0].summary &&
    rawTasks.some((task) => task.level > 1)
      ? topLevelTasks[0]
      : null;
  if (projectWrapper) {
    warnings.add(
      `The exported project summary "${projectWrapper.name}" is omitted; its tasks will be imported into the selected ManageIt project.`,
    );
  }

  const hierarchy = new Map<number, SourceTask>();
  for (const task of rawTasks) {
    if (task === projectWrapper) {
      continue;
    }
    const level = Math.max(1, task.level - (projectWrapper ? 1 : 0));
    if (level > 2) {
      errors.push(
        `Task ${task.row} "${task.name}" is nested more than one level below its project; ManageIt supports parent tasks and one subtask level.`,
      );
      continue;
    }
    task.level = level;
    const explicitParent = task.parentReference
      ? resolveTask(task.parentReference, aliasMap)
      : null;
    if (task.parentReference && !explicitParent) {
      errors.push(
        `Task ${task.row} "${task.name}": parent "${task.parentReference}" could not be matched.`,
      );
    } else if (explicitParent && explicitParent !== projectWrapper) {
      task.parentSourceId = explicitParent.sourceId;
    } else if (level === 2) {
      task.parentSourceId = hierarchy.get(1)?.sourceId ?? null;
      if (!task.parentSourceId) {
        errors.push(`Task ${task.row} "${task.name}" has no matching parent task.`);
      }
    }
    if (task.parentSourceId) {
      const parent = rawTasks.find(
        (candidate) => candidate.sourceId === task.parentSourceId,
      );
      if (!parent || parent.parentSourceId || parent === task) {
        errors.push(
          `Task ${task.row} "${task.name}" cannot be nested below another subtask.`,
        );
        task.parentSourceId = null;
      }
    }
    if (task.isMilestone && task.parentSourceId) {
      errors.push(`Task ${task.row} "${task.name}": milestones cannot be subtasks.`);
    }
    hierarchy.set(level, task);
    for (const existingLevel of [...hierarchy.keys()]) {
      if (existingLevel > level) {
        hierarchy.delete(existingLevel);
      }
    }
  }

  const parentTasks = rawTasks.filter(
    (task) => task !== projectWrapper && !task.parentSourceId,
  );
  for (const parent of parentTasks) {
    const children = rawTasks.filter(
      (task) => task.parentSourceId === parent.sourceId,
    );
    const childStarts = children
      .map((task) => task.startDate)
      .filter(isString)
      .sort();
    const childDues = children
      .map((task) => task.dueDate)
      .filter(isString)
      .sort();
    if (children.length) {
      if (!parent.startDate || parent.startDate > childStarts[0]) {
        parent.startDate = childStarts[0] ?? null;
        warnings.add(
          `Summary task dates were expanded to contain their subtasks (including "${parent.name}").`,
        );
      }
      const latestChildDue = childDues.at(-1) ?? null;
      if (!parent.dueDate || (latestChildDue && parent.dueDate < latestChildDue)) {
        parent.dueDate = latestChildDue;
        warnings.add(
          `Summary task dates were expanded to contain their subtasks (including "${parent.name}").`,
        );
      }
    }
  }

  for (const task of rawTasks) {
    if (task === projectWrapper) {
      continue;
    }
    if (!task.startDate || !task.dueDate) {
      errors.push(`Task ${task.row} "${task.name}" is missing a usable date range.`);
      continue;
    }
    if (task.dueDate < task.startDate) {
      errors.push(`Task ${task.row} "${task.name}" finishes before it starts.`);
    }
    if (task.isMilestone && task.startDate !== task.dueDate) {
      errors.push(
        `Task ${task.row} "${task.name}" is marked as a milestone but spans multiple dates.`,
      );
    }
    if (task.assignee.length > 120) {
      errors.push(`Task ${task.row} "${task.name}" has an assignee over 120 characters.`);
    }
  }

  if (document.getElementsByTagNameNS('*', 'Notes').length) {
    warnings.add(
      'Task descriptions/notes and other custom Gantt fields are not stored by ManageIt and will not be imported.',
    );
  }
  const hasUnstoredFields =
    rawTasks.some((task) => task.durationMinutes !== null) ||
    taskElements.some((element) => {
      const priority = textOf(element, 'Priority');
      return (
        (priority && Number(priority) !== 500) ||
        Number(textOf(element, 'Cost')) > 0 ||
        Number(textOf(element, 'ActualCost')) > 0
      );
    });
  if (hasUnstoredFields) {
    warnings.add(
      'Durations, priorities, costs, and notes are not stored as separate ManageIt fields; duration is only used to calculate missing finish dates.',
    );
  }

  const dependencies: GanttImportDependency[] = [];
  const seenDependencies = new Set<string>();
  for (const dependency of sourceDependencies) {
    const predecessor = resolveTask(dependency.predecessor, aliasMap);
    const successor = resolveTask(dependency.successor, aliasMap);
    if (
      !predecessor ||
      !successor ||
      predecessor === projectWrapper ||
      successor === projectWrapper
    ) {
      warnings.add('Some predecessor links could not be matched and will be skipped.');
      continue;
    }
    if (predecessor === successor) {
      errors.push(`Task "${successor.name}" cannot depend on itself.`);
      continue;
    }
    if ((dependency.type && dependency.type !== '1') || Number(dependency.lag) !== 0) {
      warnings.add(
        'ManageIt stores prerequisite links only; predecessor timing types and lag values are not preserved.',
      );
    }
    const key = `${predecessor.sourceId}\u0000${successor.sourceId}`;
    if (!seenDependencies.has(key)) {
      seenDependencies.add(key);
      dependencies.push({
        predecessorSourceId: predecessor.sourceId,
        successorSourceId: successor.sourceId,
      });
    }
  }
  if (hasDependencyCycle(rawTasks, dependencies, projectWrapper)) {
    errors.push('The predecessor links contain a dependency cycle.');
  }

  const tasks = rawTasks
    .filter(
      (task) =>
        task !== projectWrapper &&
        task.startDate &&
        task.dueDate &&
        task.level <= 2,
    )
    .sort(
      (left, right) =>
        Number(Boolean(left.parentSourceId)) -
          Number(Boolean(right.parentSourceId)) ||
        left.row - right.row,
    )
    .map(
      (task): GanttImportTask => ({
        sourceId: task.sourceId,
        sourceRow: task.row,
        parentSourceId: task.parentSourceId,
        name: task.name,
        assignee: task.assignee,
        startDate: task.startDate!,
        dueDate: task.dueDate!,
        progress: task.progress,
        status: task.status,
        isMilestone: task.isMilestone,
      }),
    );

  if (!tasks.length && !errors.length) {
    errors.push('No importable tasks were found in the XML.');
  }

  return {
    projectName: projectWrapper?.name ?? projectTitle,
    tasks,
    dependencies,
    warnings: [...warnings],
    errors,
  };
}

function readCalendars(
  document: Document,
  minutesPerDay: number,
): Map<string, WorkCalendar> {
  const calendars = new Map<string, WorkCalendar>();
  const fallback = defaultCalendar();
  for (const element of Array.from(
    document.getElementsByTagNameNS('*', 'Calendar'),
  )) {
    const id = textOf(element, 'UID');
    if (!id) {
      continue;
    }
    const baseId = textOf(element, 'BaseCalendarUID');
    const base = calendars.get(baseId) ?? fallback;
    const weekdays = new Map(base.weekdays);
    const weekDaysContainer = directChild(element, 'WeekDays');
    const weekDayElements = weekDaysContainer
      ? directChildren(weekDaysContainer, 'WeekDay')
      : directChildren(element, 'WeekDay');
    for (const day of weekDayElements) {
      const dayType = Number(textOf(day, 'DayType'));
      if (!Number.isInteger(dayType) || dayType < 1 || dayType > 7) {
        continue;
      }
      const workingTimes = directChild(day, 'WorkingTimes');
      const intervals =
        textOf(day, 'DayWorking') === '0'
          ? []
          : workingTimes
            ? directChildren(workingTimes, 'WorkingTime')
                .map(readWorkInterval)
                .filter(isInterval)
            : weekdays.get(dayType) ?? [];
      weekdays.set(dayType, intervals);
    }
    const exceptions = directChild(element, 'Exceptions');
    const calendarExceptions = exceptions
      ? directChildren(exceptions, 'Exception')
          .map((exception) => {
            const period = directChild(exception, 'TimePeriod') ?? exception;
            const startDate = parseXmlDate(textOf(period, 'FromDate'));
            const endDate = parseXmlDate(textOf(period, 'ToDate'));
            if (!startDate || !endDate) {
              return null;
            }
            const workingTimes = directChild(exception, 'WorkingTimes');
            const intervals =
              textOf(exception, 'DayWorking') === '0'
                ? []
                : workingTimes
                  ? directChildren(workingTimes, 'WorkingTime')
                      .map(readWorkInterval)
                      .filter(isInterval)
                  : [];
            return { startDate, endDate, intervals };
          })
          .filter(isCalendarException)
      : [];
    calendars.set(id, {
      weekdays: weekdays.size ? weekdays : fallback.weekdays,
      exceptions: calendarExceptions,
    });
  }
  return calendars;
}

function defaultCalendar(): WorkCalendar {
  const weekdays = new Map<number, WorkInterval[]>();
  for (let day = 2; day <= 6; day += 1) {
    weekdays.set(day, [{ start: 9 * 60, end: 17 * 60 }]);
  }
  weekdays.set(1, []);
  weekdays.set(7, []);
  return { weekdays, exceptions: [] };
}

function readWorkInterval(element: Element): WorkInterval | null {
  const start = parseTime(textOf(element, 'FromTime'));
  const end = parseTime(textOf(element, 'ToTime'));
  return start !== null && end !== null && end > start
    ? { start, end }
    : null;
}

function finishDateFromDuration(
  startText: string,
  durationMinutes: number,
  calendar: WorkCalendar,
): string | null {
  const start = parseXmlDateTime(startText);
  if (!start) {
    return null;
  }
  if (durationMinutes === 0) {
    return start.date;
  }
  if (durationMinutes < 0 || durationMinutes > MAX_SCHEDULE_DAYS * 24 * 60) {
    return null;
  }
  let remaining = durationMinutes;
  const dayStart = Date.UTC(
    Number(start.date.slice(0, 4)),
    Number(start.date.slice(5, 7)) - 1,
    Number(start.date.slice(8, 10)),
  );
  for (let offset = 0; offset < MAX_SCHEDULE_DAYS; offset += 1) {
    const currentDay = new Date(dayStart + offset * DAY_MS);
    const date = currentDay.toISOString().slice(0, 10);
    const dayType = currentDay.getUTCDay() + 1;
    const exception = calendar.exceptions.find(
      (entry) => date >= entry.startDate && date <= entry.endDate,
    );
    const intervals =
      exception?.intervals ?? calendar.weekdays.get(dayType) ?? [];
    for (const interval of intervals) {
      const intervalStart = dayStart + offset * DAY_MS + interval.start * 60000;
      const intervalEnd = dayStart + offset * DAY_MS + interval.end * 60000;
      const availableFrom = Math.max(start.timestamp, intervalStart);
      if (availableFrom >= intervalEnd) {
        continue;
      }
      const availableMinutes = (intervalEnd - availableFrom) / 60000;
      if (remaining <= availableMinutes) {
        return new Date(availableFrom + remaining * 60000)
          .toISOString()
          .slice(0, 10);
      }
      remaining -= availableMinutes;
    }
  }
  return null;
}

function parseXmlDateTime(value: string): { date: string; timestamp: number } | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (!match) {
    return null;
  }
  const date = makeDate(Number(match[1]), Number(match[2]), Number(match[3]));
  if (!date) {
    return null;
  }
  const timestamp = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? 0),
    Number(match[5] ?? 0),
    Number(match[6] ?? 0),
  );
  return { date, timestamp };
}

function parseXmlDate(value: string): string | null {
  return parseXmlDateTime(value)?.date ?? null;
}

function parseDuration(
  value: string,
  minutesPerDay: number,
  minutesPerWeek: number,
  daysPerMonth: number,
): number | null {
  const match = value.match(
    /^P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i,
  );
  if (!match) {
    return null;
  }
  const years = Number(match[1] ?? 0);
  const months = Number(match[2] ?? 0);
  const weeks = Number(match[3] ?? 0);
  const days = Number(match[4] ?? 0);
  const hours = Number(match[5] ?? 0);
  const minutes = Number(match[6] ?? 0);
  const seconds = Number(match[7] ?? 0);
  const total =
    (years * 12 * daysPerMonth + months * daysPerMonth + days) *
      minutesPerDay +
    weeks * minutesPerWeek +
    hours * 60 +
    minutes +
    seconds / 60;
  return Number.isFinite(total) ? total : null;
}

function readResourceNames(document: Document): Map<string, string> {
  const names = new Map<string, string>();
  for (const resource of Array.from(
    document.getElementsByTagNameNS('*', 'Resource'),
  )) {
    const id = textOf(resource, 'UID');
    const name = textOf(resource, 'Name');
    if (id && name) {
      names.set(id, name);
    }
  }
  return names;
}

function readAssignments(
  document: Document,
  resourceNames: Map<string, string>,
): Map<string, string> {
  const assignments = new Map<string, Set<string>>();
  for (const assignment of Array.from(
    document.getElementsByTagNameNS('*', 'Assignment'),
  )) {
    const taskId = textOf(assignment, 'TaskUID') || textOf(assignment, 'TaskID');
    const resourceId =
      textOf(assignment, 'ResourceUID') || textOf(assignment, 'ResourceID');
    const name = resourceNames.get(resourceId);
    if (taskId && name) {
      const names = assignments.get(taskId) ?? new Set<string>();
      names.add(name);
      assignments.set(taskId, names);
    }
  }
  return new Map(
    [...assignments].map(([taskId, names]) => [
      taskId,
      [...names].join(', '),
    ]),
  );
}

function resolveTask(
  reference: string,
  aliases: Map<string, SourceTask[]>,
): SourceTask | null {
  const matches = aliases.get(reference);
  return matches?.length === 1 ? matches[0] : null;
}

function hasDependencyCycle(
  tasks: SourceTask[],
  dependencies: GanttImportDependency[],
  ignoredTask: SourceTask | null,
): boolean {
  const included = tasks.filter((task) => task !== ignoredTask);
  const indegree = new Map(included.map((task) => [task.sourceId, 0]));
  const successors = new Map<string, string[]>();
  for (const edge of dependencies) {
    const next = successors.get(edge.predecessorSourceId) ?? [];
    next.push(edge.successorSourceId);
    successors.set(edge.predecessorSourceId, next);
    indegree.set(
      edge.successorSourceId,
      (indegree.get(edge.successorSourceId) ?? 0) + 1,
    );
  }
  const pending = [...indegree]
    .filter(([, count]) => count === 0)
    .map(([sourceId]) => sourceId);
  let visited = 0;
  while (pending.length) {
    const sourceId = pending.pop()!;
    visited += 1;
    for (const successor of successors.get(sourceId) ?? []) {
      const count = (indegree.get(successor) ?? 0) - 1;
      indegree.set(successor, count);
      if (count === 0) {
        pending.push(successor);
      }
    }
  }
  return visited !== included.length;
}

function splitReferences(value: string): string[] {
  return value
    .split(/[;,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function textOf(element: Element, name: string): string {
  return directChild(element, name)?.textContent?.trim() ?? '';
}

function directChild(element: Element, name: string): Element | null {
  const normalizedName = normalize(name);
  return (
    Array.from(element.children).find(
      (child) => normalize(child.localName) === normalizedName,
    ) ?? null
  );
}

function directChildren(element: Element, name: string): Element[] {
  const normalizedName = normalize(name);
  return Array.from(element.children).filter(
    (child) => normalize(child.localName) === normalizedName,
  );
}

function normalize(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 24 && minutes < 60 ? hours * 60 + minutes : null;
}

function positiveNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isTrue(value: string): boolean {
  return ['1', 'true', 'yes'].includes(value.toLocaleLowerCase());
}

function isInterval(value: WorkInterval | null): value is WorkInterval {
  return value !== null;
}

function isCalendarException(
  value: CalendarException | null,
): value is CalendarException {
  return value !== null;
}

function isString(value: string | null): value is string {
  return typeof value === 'string';
}

function makeDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}
