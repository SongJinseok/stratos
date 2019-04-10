import { Component, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { Observable, of as observableOf } from 'rxjs';
import { combineLatest, first, map } from 'rxjs/operators';

import {
  UsersRolesClear,
  UsersRolesExecuteChanges,
  UsersRolesSetChanges,
  UsersRolesSetOrg,
  UsersRolesSetUsers,
} from '../../../../../../store/src/actions/users-roles.actions';
import { AppState } from '../../../../../../store/src/app-state';
import { selectUsersRoles } from '../../../../../../store/src/selectors/users-roles.selector';
import { CfUser } from '../../../../../../store/src/types/user.types';
import { StepOnNextFunction } from '../../../../shared/components/stepper/step/step.component';
import { CfUserService } from '../../../../shared/data-services/cf-user.service';
import { ActiveRouteCfOrgSpace } from '../../cf-page.types';
import { getActiveRouteCfOrgSpaceProvider } from '../../cf.helpers';
import { CfRolesService } from '../manage-users/cf-roles.service';


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
  onlySpaces = false;

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
    this.onlySpaces = this.route.snapshot.queryParamMap.get('spaces') === 'true';

    const userQParam = this.route.snapshot.queryParamMap.get('user');
    if (userQParam) {
      this.singleUser$ = this.cfUserService.getUser(activeRouteCfOrgSpace.cfGuid, userQParam)
        .pipe(
          map(user => user.entity),
        );
      // catchError and throw 404
    } else {
      console.log('user not found page');
    }



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
      combineLatest(this.singleUser$),
      first(),
    ).subscribe(([existingRoles, user]) => {
      const changes = [];
      const orgs = existingRoles[user.guid];
      let orgGuids;



      if (this.orgGuid) {
        orgGuids = [this.orgGuid];
        this.store.dispatch(new UsersRolesSetOrg(this.orgGuid, orgs[this.orgGuid].name));
      } else {
        orgGuids = Object.keys(orgs);
        this.store.dispatch(new UsersRolesSetOrg(orgGuids[0], orgs[orgGuids[0]].name));
      }

      for (const orgGuid of orgGuids) {
        const org = orgs[orgGuid];

        if (!this.spaceGuid && !this.onlySpaces) {
          for (const role of Object.keys(org.permissions)) {
            const value = org.permissions[role];

            if (value) {
              // this.store.dispatch(new UsersRolesSetOrgRole(orgGuid, role, false));
              changes.push({
                userGuid: user.guid,
                orgGuid,
                orgName: org.name,
                add: false,
                role,
              });
            }
          }
        }

        let spaceGuids;

        if (this.spaceGuid) {
          spaceGuids = [this.spaceGuid];
        } else {
          spaceGuids = Object.keys(org.spaces);
        }

        for (const spaceGuid of spaceGuids) {
          const space = org.spaces[spaceGuid];

          for (const role of Object.keys(space.permissions)) {
            const value = space.permissions[role];
            if (value) {
              // this.store.dispatch(new UsersRolesSetSpaceRole(orgGuid, spaceGuid, role, false));
              changes.push({
                userGuid: user.guid,
                orgGuid,
                orgName: org.name,
                spaceGuid,
                spaceName: space.name,
                add: false,
                role,
              });
            }
          }
        }
      }

      this.store.dispatch(new UsersRolesSetChanges(changes));
    });
  }

  ngOnDestroy(): void {
    this.store.dispatch(new UsersRolesClear());
  }

  markRolesToRemoval() {
    // TBD
  }

  markOrgRolesToRemoval() {
    // TBD
  }

  markSpaceRolesToRemoval() {
    // TBD
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
