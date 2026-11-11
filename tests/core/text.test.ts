import { expect, test } from 'vitest';
import { displayName, initials } from '../../src/core/text';
import type { LiveUser } from '../../src/core/events';

const u = (p: Partial<LiveUser>): LiveUser => ({ userId: '1', handle: 'h', nickname: '', avatarUrl: null, ...p });

test('displayName', () => {
  expect(displayName(u({ nickname: 'Mai' }))).toBe('Mai');
  expect(displayName(u({ nickname: 'abcdefghijklmnopq' }))).toBe('abcdefghijklmn…');
  expect(displayName(u({ nickname: '👨‍👩‍👧'.repeat(20) }))).toBe('👨‍👩‍👧'.repeat(14) + '…');
  expect(displayName(u({ nickname: '   ', handle: 'mai_test' }))).toBe('@mai_test');
});
test('initials', () => {
  expect(initials(u({ nickname: 'đỗ' }))).toBe('Đ');
  expect(initials(u({ nickname: '', handle: '' }))).toBe('?');
});
