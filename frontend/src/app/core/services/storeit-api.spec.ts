import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProjectsService } from './projects';
import { TasksService } from './tasks';

describe('StoreIt API namespaces', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads ManageIt projects from the ManageIt namespace', () => {
    TestBed.inject(ProjectsService).list().subscribe();

    const request = httpMock.expectOne('/api/manageit/projects');
    expect(request.request.method).toBe('GET');
    request.flush({ projects: [] });
  });

  it('loads ManageIt tasks from the ManageIt namespace', () => {
    TestBed.inject(TasksService).list('project-1').subscribe();

    const request = httpMock.expectOne('/api/manageit/projects/project-1/tasks');
    expect(request.request.method).toBe('GET');
    request.flush({ tasks: [] });
  });
});
