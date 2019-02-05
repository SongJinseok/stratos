import { e2e } from '../../e2e';
import { E2EConfigCloudFoundry } from '../../e2e.types';
import { ConsoleUserType } from '../../helpers/e2e-helpers';
import { CFPage } from '../../po/cf-page.po';
import { SideNavMenuItem } from '../../po/side-nav.po';
import { CfTopLevelPage } from './cf-top-level-page.po';
import { ConfigInviteClientDialog } from './config-invite-client-dialog.po';

/**
 * Test the invite user config process.
 * Note - We test non-admin disabled case in `src/test-e2e/cloud-foundry/cf-level/cf-top-level-e2e.spec.ts`
 */
describe('CF - Invite User Configuration - ', () => {
  let defaultCf: E2EConfigCloudFoundry = e2e.secrets.getDefaultCFEndpoint();

  if (!defaultCf.invite || !defaultCf.invite.run) {
    e2e.log('Skipping Invite User Configuration Tests');
    return;
  }

  let cfPage: CfTopLevelPage;

  beforeAll(() => {
    defaultCf = e2e.secrets.getDefaultCFEndpoint();
    const e2eSetup = e2e.setup(ConsoleUserType.admin)
      .clearAllEndpoints()
      .registerDefaultCloudFoundry()
      .connectAllEndpoints(ConsoleUserType.admin)
      .connectAllEndpoints(ConsoleUserType.user);
    // There is only one CF endpoint registered (since that is what we setup)
    const page = new CFPage();
    page.sideNav.goto(SideNavMenuItem.CloudFoundry);
    CfTopLevelPage.detect().then(p => {
      cfPage = p;
      cfPage.waitForPageOrChildPage();
      cfPage.loadingIndicator.waitUntilNotShown();
    });
  });

  describe('Configure - ', () => {
    it('Initial State', () => {
      expect(cfPage.isUserInviteConfigured(true)).toBeFalsy();
      expect(cfPage.canConfigureUserInvite()).toBeTruthy();
    });

    it('Bad Creds', () => {
      cfPage.clickInviteConfigure();
      const dialog = new ConfigInviteClientDialog();
      expect(dialog.canConfigure()).toBeFalsy();
      dialog.form.fill({ clientid: 'clientid' });
      expect(dialog.canConfigure()).toBeFalsy();
      dialog.form.fill({ clientsecret: 'clientsecret' });
      expect(dialog.canConfigure()).toBeTruthy();
      dialog.configure();
      dialog.snackBar.waitForMessage('Could not check Client: Bad credentials');
      dialog.snackBar.close();
      dialog.cancel();
      expect(cfPage.isUserInviteConfigured(true)).toBeFalsy();
      expect(cfPage.canConfigureUserInvite()).toBeTruthy();
    });

    it('Good Creds', () => {
      cfPage.clickInviteConfigure();
      const dialog = new ConfigInviteClientDialog();
      expect(dialog.canConfigure()).toBeFalsy();
      dialog.form.fill({ clientid: defaultCf.invite.clientId, clientsecret: defaultCf.invite.clientSecret });
      expect(dialog.canConfigure()).toBeTruthy();
      dialog.configure();
      expect(cfPage.isUserInviteConfigured(true)).toBeTruthy();
      expect(cfPage.canConfigureUserInvite()).toBeFalsy();
    });
  });

  describe('UnConfigure - ', () => {
    it('Initial State', () => {
      expect(cfPage.isUserInviteConfigured(true)).toBeTruthy();
      expect(cfPage.canConfigureUserInvite()).toBeFalsy();
    });

    it('UnConfigure', () => {
      cfPage.clickInviteDisable();
    });

    it('End State', () => {
      expect(cfPage.isUserInviteConfigured(true)).toBeFalsy();
      expect(cfPage.canConfigureUserInvite()).toBeTruthy();
    });
  });

});

