import { parseGanttXml } from './gantt-importer';

const xml = `<?xml version="1.0"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Title>Demo schedule</Title>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2400</MinutesPerWeek>
  <DaysPerMonth>20</DaysPerMonth>
  <CalendarUID>1</CalendarUID>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <BaseCalendarUID>-1</BaseCalendarUID>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>13:00:00</ToTime></WorkingTime><WorkingTime><FromTime>14:00:00</FromTime><ToTime>21:30:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>13:00:00</ToTime></WorkingTime><WorkingTime><FromTime>14:00:00</FromTime><ToTime>21:30:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>13:00:00</ToTime></WorkingTime><WorkingTime><FromTime>14:00:00</FromTime><ToTime>21:30:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>13:00:00</ToTime></WorkingTime><WorkingTime><FromTime>14:00:00</FromTime><ToTime>21:30:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking><WorkingTimes><WorkingTime><FromTime>07:00:00</FromTime><ToTime>13:00:00</ToTime></WorkingTime><WorkingTime><FromTime>14:00:00</FromTime><ToTime>21:30:00</ToTime></WorkingTime></WorkingTimes></WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task><UID>1</UID><ID>1</ID><Name>Demo schedule</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary><Start>2026-09-11T07:00:00</Start><Duration>PT486H0M0S</Duration></Task>
    <Task><UID>2</UID><ID>2</ID><Name>Deliverables</Name><OutlineLevel>2</OutlineLevel><Summary>1</Summary><Start>2026-09-23T07:00:00</Start><Duration>PT378H0M0S</Duration></Task>
    <Task><UID>3</UID><ID>3</ID><Name>Production</Name><OutlineLevel>3</OutlineLevel><Summary>0</Summary><Start>2026-09-24T07:00:00</Start><Duration>PT135H0M0S</Duration><PercentComplete>25</PercentComplete></Task>
    <Task><UID>4</UID><ID>4</ID><Name>Delivery</Name><OutlineLevel>3</OutlineLevel><Summary>0</Summary><Start>2026-10-07T07:00:00</Start><Duration>PT13H30M0S</Duration><PercentComplete>0</PercentComplete><PredecessorLink><PredecessorUID>3</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink></Task>
  </Tasks>
</Project>`;

describe('Gantt XML import', () => {
  it('omits the project summary, preserves task hierarchy and schedules duration dates', () => {
    const preview = parseGanttXml(xml);

    expect(preview.projectName).toBe('Demo schedule');
    expect(preview.errors).toEqual([]);
    expect(preview.tasks).toHaveLength(3);
    expect(preview.tasks[0]).toMatchObject({
      sourceId: '2',
      parentSourceId: null,
      name: 'Deliverables',
      startDate: '2026-09-23',
      dueDate: '2026-10-30',
    });
    expect(preview.tasks[1]).toMatchObject({
      sourceId: '3',
      parentSourceId: '2',
      name: 'Production',
      startDate: '2026-09-24',
      dueDate: '2026-10-07',
      progress: 25,
      status: 'in_progress',
    });
    expect(preview.dependencies).toEqual([
      { predecessorSourceId: '3', successorSourceId: '4' },
    ]);
  });

  it('rejects XML with a document type declaration', () => {
    expect(() => parseGanttXml('<!DOCTYPE Project><Project />')).toThrow(
      'document type declaration',
    );
  });
});
