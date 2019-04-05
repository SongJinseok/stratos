import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, of as observableOf } from 'rxjs';
import { combineLatest, filter, first, map, catchError, debounceTime, switchMap } from 'rxjs/operators';

import {
  UsersRolesClear,
  UsersRolesExecuteChanges,
  UsersRolesSetUsers,
  UsersRolesSetOrgRole,
  UsersRolesSetSpaceRole,
  UsersRolesSetChanges,
  UsersRolesSetOrg,
} from '../../../../../../store/src/actions/users-roles.actions';
import { AppState } from '../../../../../../store/src/app-state';
import { selectUsersRoles, selectUsersRolesRoles } from '../../../../../../store/src/selectors/users-roles.selector';
import { CfUser, OrgUserRoleNames } from '../../../../../../store/src/types/user.types';
import { StepOnNextFunction } from '../../../../shared/components/stepper/step/step.component';
import { CfUserService } from '../../../../shared/data-services/cf-user.service';
import { ActiveRouteCfOrgSpace } from '../../cf-page.types';
import { getActiveRouteCfOrgSpaceProvider } from '../../cf.helpers';
import { CfRolesService } from '../manage-users/cf-roles.service';
import { CfRoleChange } from '../../../../../../store/src/types/users-roles.types';


@Component({
  selector: 'app-remove-user',
  templateUrl: './remove-user.component.html',
  styleUrls: ['./remove-user.component.scss'],
  providers: [
    getActiveRouteCfOrgSpaceProvider,
    CfUserService,
    CfRolesService
  ]
})
export class RemoveUserComponent implements OnDestroy {
  initialUsers$: Observable<CfUser[]>;
  singleUser$: Observable<CfUser>;
  defaultCancelUrl: string;
  orgGuid: string;
  spaceGuid: string;
  applyStarted = false;

  constructor(
    private store: Store<AppState>,
    private activeRouteCfOrgSpace: ActiveRouteCfOrgSpace,
    private cfUserService: CfUserService,
    private cfRolesService: CfRolesService,
    private route: ActivatedRoute
  ) {
    this.defaultCancelUrl = this.createReturnUrl(activeRouteCfOrgSpace);
    this.orgGuid = this.activeRouteCfOrgSpace.orgGuid;
    this.spaceGuid = this.activeRouteCfOrgSpace.spaceGuid;

    const userQParam = this.route.snapshot.queryParams.user;
    if (userQParam) {
      this.singleUser$ = this.cfUserService.getUser(activeRouteCfOrgSpace.cfGuid, userQParam)
        .pipe(
          map(user => user.entity)
        );
        // catchError and throw 404
    } else {
      console.log('user not found page');
    }

    this.store.dispatch(new UsersRolesSetOrg(activeRouteCfOrgSpace.orgGuid));

    // Ensure that when we arrive here directly the store is set up with all it needs
    this.store.select(selectUsersRoles).pipe(
      combineLatest(this.singleUser$),
      first()
    ).subscribe(([usersRoles, user]) => {
      if (!usersRoles.cfGuid || !user) {
        this.store.dispatch(new UsersRolesSetUsers(activeRouteCfOrgSpace.cfGuid, [user]));
      }
    });

    this.cfRolesService.existingRoles$.pipe(
      combineLatest(this.singleUser$)
    ).subscribe(([existingRoles, user]) => {
      const orgs = existingRoles[user.guid];
      const org = orgs[this.orgGuid];
      const changes: CfRoleChange[] = [];

      for (const role of Object.keys(org.permissions)) {
        const value = org.permissions[role];

        if (value) {
          this.store.dispatch(new UsersRolesSetOrgRole(this.orgGuid, role, false));
          changes.push({
            userGuid: user.guid,
            orgGuid: this.orgGuid,
            add: false,
            role: OrgUserRoleNames.MANAGER
          });
        }
      }

      this.store.dispatch(new UsersRolesSetChanges(changes));

      // this.store.dispatch(new UsersRolesSetSpaceRole(this.orgGuid, this.spaceGuid, role, false));
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(new UsersRolesClear());
  }

  /**
   * Determine where the return url should be. This will only apply when user visits modal directly (otherwise stepper uses previous state)
   */
  createReturnUrl(activeRouteCfOrgSpace: ActiveRouteCfOrgSpace): string {
    let route = `/cloud-foundry/${activeRouteCfOrgSpace.cfGuid}`;
    if (this.activeRouteCfOrgSpace.orgGuid) {
      route += `/organizations/${activeRouteCfOrgSpace.orgGuid}`;
      if (this.activeRouteCfOrgSpace.spaceGuid) {
        route += `/spaces/${activeRouteCfOrgSpace.spaceGuid}`;
      }
    }
    route += `/users`;
    return route;
  }

  startApply: StepOnNextFunction = () => {
    if (this.applyStarted) {
      return observableOf({ success: true, redirect: true });
    }
    this.applyStarted = true;
    this.store.dispatch(new UsersRolesExecuteChanges());
    return observableOf({ success: true, ignoreSuccess: true });
  }
}
