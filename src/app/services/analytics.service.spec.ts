import { firstValueFrom } from 'rxjs';
import { AnalyticsService } from './analytics.service';
import { CirculationCoordinator } from './circulation-coordinator.service';
import { MemoryBookStorage, MemoryCirculationStorage, MemoryMemberStorage } from './circulation-test-storage';
import { LibraryActivityService } from './library-activity.service';
import { LibraryPolicyService } from './library-policy.service';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberService } from './member.service';

describe('analytics records', () => {
  it('reads committed data without writes and records future registrations exactly once', async () => {
    const inventory = new MemoryCirculationStorage();
    const memberStorage = new MemoryMemberStorage();
    const deletion = new MemberDeletionPolicy(inventory);
    const members = new MemberService(memberStorage, deletion);
    const coordinator = new CirculationCoordinator(inventory, new MemoryBookStorage('[]'), memberStorage, members, new LibraryPolicyService());
    try {
      await coordinator.refresh();
      const activityService = new LibraryActivityService(coordinator);
      const service = new AnalyticsService(coordinator, members, activityService);
      const before = inventory.value;
      const source = await firstValueFrom(service.source$);
      expect(source.activity).toEqual([]);
      expect(inventory.value).toBe(before);
      const template = source.members[0];
      const member = await firstValueFrom(members.create({ ...template, firstName: 'Future', lastName: 'Member',
        email: 'new@example.invalid' }));
      const activity = (await firstValueFrom(service.source$)).activity.filter(event => event.type === 'member-registered');
      expect(activity.length).toBe(1);
      expect(activity[0].entityId).toBe(member.id);
      await firstValueFrom(members.delete(member.id));
      const reopened = new MemberService(memberStorage, deletion);
      const after = await firstValueFrom(new AnalyticsService(coordinator, reopened, activityService).source$);
      expect(after.activity.filter(event => event.type === 'member-registered')).toEqual(activity);
    } finally {
      coordinator.ngOnDestroy();
    }
  });
});
