import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { UserName } from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class UsersService {
  private readonly http = inject(HttpClient);

  listNames(): Observable<UserName[]> {
    return this.http
      .get<{ users: UserName[]; currentUserId: string }>('/api/report/users')
      .pipe(map(({ users }) => users));
  }
}
