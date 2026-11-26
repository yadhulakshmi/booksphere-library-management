import { firstValueFrom, of } from 'rxjs';
import { localDate } from '../core/member-rules';
import { MemberInput, MembershipState } from '../models/library';
import { MemberDeletionPolicy } from './member-deletion-policy';
import { MemberStorageService } from './member-storage.service';
import { MemberService } from './member.service';

class MemoryStorage extends MemberStorageService {
  value: string | null = null;
  failWrite = false;
  private queue: Promise<unknown> = Promise.resolve();

  override read(): string | null { return this.value; }

  override write(snapshot: string): void {
    if (this.failWrite) {
      throw new Error('Quota exceeded');
    }
    this.value = snapshot;
  }

  override transaction<T>(operation: () => T): Promise<T> {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}

function offset(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localDate(date);
}

describe('MemberService', () => {
  const input: MemberInput = {
    firstName: 'Taylor', lastName: 'Sample', email: ' Taylor.Sample@example.invalid ',
    phone: '+1 202-555-0170', address: '31 Example Lane', membershipType: 'Student',
    registrationDate: offset(-10), expiryDate: offset(30), notes: ''
  };
  let storage: MemoryStorage;
  let policy: MemberDeletionPolicy;
  let service: MemberService;

  beforeEach(() => {
    storage = new MemoryStorage();
    policy = new MemberDeletionPolicy();
    service = new MemberService(storage, policy);
  });

  it('seeds 30 fictional members and publishes new members', async () => {
    const seeded = await firstValueFrom(service.members$);
    expect(seeded.length).toBe(30);
    expect(seeded.every(member => member.demonstration && member.email.endsWith('@example.invalid'))).toBeTrue();
    expect(new Set(seeded.map(member => member.status)).size).toBe(4);
    const member = await firstValueFrom(service.create(input));
    expect(member.membershipId).toBe('BS-000031');
    expect(member.initials).toBe('TS');
    expect(member.email).toBe('taylor.sample@example.invalid');
    expect((await firstValueFrom(service.members$)).length).toBe(31);
  });

  it('edits contact details while retaining both identifiers and creation date', async () => {
    const member = await firstValueFrom(service.create(input));
    const edited = await firstValueFrom(service.update(member.id, { ...input, firstName: 'Tara', notes: ' Updated ' }));
    expect(edited.id).toBe(member.id);
    expect(edited.membershipId).toBe(member.membershipId);
    expect(edited.createdAt).toBe(member.createdAt);
    expect(edited.firstName).toBe('Tara');
    expect(edited.notes).toBe('Updated');
  });

  it('issues distinct IDs for queued creates and retires IDs after deletion and reload', async () => {
    const other = new MemberService(storage, policy);
    const [first, second] = await Promise.all([
      firstValueFrom(service.create(input)),
      firstValueFrom(other.create({ ...input, email: 'other@example.invalid' }))
    ]);
    expect(first.membershipId).not.toBe(second.membershipId);
    await firstValueFrom(other.delete(second.id));
    const reloaded = new MemberService(storage, policy);
    const next = await firstValueFrom(reloaded.create({ ...input, email: 'new@example.invalid' }));
    expect(next.membershipId).toBe('BS-000033');
  });

  it('rejects duplicate normalized emails on create and edit', async () => {
    await firstValueFrom(service.create(input));
    await expectAsync(firstValueFrom(service.create({ ...input, email: 'TAYLOR.SAMPLE@EXAMPLE.INVALID' })))
      .toBeRejectedWithError(/email already exists/);
    const other = await firstValueFrom(service.create({ ...input, email: 'other@example.invalid' }));
    await expectAsync(firstValueFrom(service.update(other.id, input))).toBeRejectedWithError(/email already exists/);
  });

  it('validates calendar dates, ordering and contact fields', async () => {
    await expectAsync(firstValueFrom(service.create({ ...input, registrationDate: '2025-02-30' }))).toBeRejectedWithError(/Registration/);
    await expectAsync(firstValueFrom(service.create({ ...input, registrationDate: offset(1) }))).toBeRejectedWithError(/Registration/);
    await expectAsync(firstValueFrom(service.create({ ...input, expiryDate: offset(-11) }))).toBeRejectedWithError(/Expiry/);
    await expectAsync(firstValueFrom(service.create({ ...input, email: 'invalid' }))).toBeRejectedWithError(/email/);
    await expectAsync(firstValueFrom(service.create({ ...input, phone: '123' }))).toBeRejectedWithError(/phone/);
  });

  it('keeps membership valid through its expiry date and renews expired memberships', async () => {
    const current = await firstValueFrom(service.create({ ...input, expiryDate: localDate() }));
    expect(current.status).toBe('Active');
    const expired = await firstValueFrom(service.update(current.id, { ...input, expiryDate: offset(-1) }));
    expect(expired.status).toBe('Expired');
    await expectAsync(firstValueFrom(service.renew(expired.id, localDate()))).toBeRejectedWithError(/expiry date/);
    const renewed = await firstValueFrom(service.renew(expired.id, offset(60)));
    expect(renewed.status).toBe('Active');
    await expectAsync(firstValueFrom(service.renew(renewed.id, renewed.expiryDate))).toBeRejectedWithError(/expiry date/);
  });

  it('preserves suspended and inactive statuses through renewal', async () => {
    const member = await firstValueFrom(service.create(input));
    await firstValueFrom(service.changeStatus(member.id, 'Suspended'));
    expect((await firstValueFrom(service.renew(member.id, offset(60)))).status).toBe('Suspended');
    await firstValueFrom(service.changeStatus(member.id, 'Inactive'));
    expect((await firstValueFrom(service.renew(member.id, offset(90)))).status).toBe('Inactive');
  });

  it('validates status changes and blocks activation past expiry', async () => {
    const member = await firstValueFrom(service.create({ ...input, expiryDate: offset(-1) }));
    await firstValueFrom(service.changeStatus(member.id, 'Inactive'));
    await expectAsync(firstValueFrom(service.changeStatus(member.id, 'Active'))).toBeRejectedWithError(/Renew/);
    await expectAsync(firstValueFrom(service.changeStatus(member.id, 'Expired' as MembershipState)))
      .toBeRejectedWithError(/valid membership status/);
    await firstValueFrom(service.renew(member.id, offset(60)));
    expect((await firstValueFrom(service.changeStatus(member.id, 'Active'))).status).toBe('Active');
  });

  it('consults the deletion policy and persists eligible deletion', async () => {
    const member = await firstValueFrom(service.create(input));
    const restriction = spyOn(policy, 'reasonFor').and.returnValue(of('Test: active circulation record.'));
    await expectAsync(firstValueFrom(service.delete(member.id))).toBeRejectedWithError(/circulation record/);
    expect(restriction).toHaveBeenCalledWith(member.id);
    restriction.and.returnValue(of(null));
    await firstValueFrom(service.delete(member.id));
    expect((await firstValueFrom(new MemberService(storage, policy).members$)).some(record => record.id === member.id)).toBeFalse();
  });

  it('restores edits and keeps initialized empty storage empty', async () => {
    const member = await firstValueFrom(service.create(input));
    await firstValueFrom(service.update(member.id, { ...input, notes: 'Saved' }));
    expect((await firstValueFrom(new MemberService(storage, policy).members$)).find(record => record.id === member.id)?.notes)
      .toBe('Saved');
    storage.value = JSON.stringify({ lastIssued: 31, records: [] });
    const reloaded = new MemberService(storage, policy);
    expect(await firstValueFrom(reloaded.members$)).toEqual([]);
    expect((await firstValueFrom(reloaded.create(input))).membershipId).toBe('BS-000032');
  });

  it('does not overwrite damaged storage or publish failed writes', async () => {
    await firstValueFrom(service.members$);
    storage.failWrite = true;
    await expectAsync(firstValueFrom(service.create(input))).toBeRejectedWithError(/could not save/);
    expect((await firstValueFrom(service.members$)).length).toBe(30);
    storage.failWrite = false;
    storage.value = '{bad data';
    const reloaded = new MemberService(storage, policy);
    expect(await firstValueFrom(reloaded.members$)).toEqual([]);
    expect(await firstValueFrom(reloaded.storageWarning$)).toContain('invalid');
    await expectAsync(firstValueFrom(reloaded.create(input))).toBeRejectedWithError(/invalid/);
    expect(storage.value).toBe('{bad data');
  });
});
