import type { LiveUser } from './events';

const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function graphemes(s: string): string[] {
  return Array.from(seg.segment(s), x => x.segment);
}

/** Tên hiển thị: nickname, rỗng thì '@handle'; dài quá thì cắt theo grapheme và thêm '…'. */
export function displayName(user: LiveUser, max = 14): string {
  const nick = user.nickname.trim();
  const name = nick !== '' ? nick : user.handle.trim() !== '' ? '@' + user.handle.trim() : '';
  const g = graphemes(name);
  return g.length > max ? g.slice(0, max).join('') + '…' : name;
}

export function initials(user: LiveUser): string {
  const name = displayName(user).replace(/^@/, '');
  const first = graphemes(name)[0];
  return first ? first.toUpperCase() : '?';
}
