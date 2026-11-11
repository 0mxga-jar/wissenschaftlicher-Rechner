/** Natural Display: zeichnet eine Formelzeile (mit optionalem Cursor) als HTML. */
import type { ComponentChildren, VNode } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { MNode, MRow, MTpl } from '../core/mathtree';
import { tokenClass, tokenLabel } from './tokens';

interface Props {
  row: MRow;
  /** Cursorpfad oder null (kein Cursor) */
  cursor?: number[] | null;
  comma?: boolean;
  /** Antippen setzt den Cursor */
  onPick?: (path: number[]) => void;
  class?: string;
}

interface Ctx {
  cursor: number[] | null;
  comma: boolean;
}

const Cursor = (): VNode => <span class="m-cursor" key="cursor" />;

function cursorIndex(prefix: number[], cursor: number[] | null): number {
  if (!cursor || cursor.length !== prefix.length + 1) return -1;
  for (let i = 0; i < prefix.length; i++) if (cursor[i] !== prefix[i]) return -1;
  return cursor[cursor.length - 1];
}

const isPow = (n: MNode | undefined): n is MTpl => !!n && n.t === 'tpl' && n.k === 'pow';

function renderRow(row: MRow, prefix: number[], ctx: Ctx, root = false): VNode {
  const cur = cursorIndex(prefix, ctx.cursor);
  if (row.length === 0) {
    return (
      <span class={root ? 'm-row' : 'm-row m-empty'} data-s={JSON.stringify(prefix)} data-n="0">
        {cur === 0 ? <Cursor /> : null}
      </span>
    );
  }
  const items: ComponentChildren[] = [];
  let i = 0;
  while (i < row.length) {
    if (cur === i) items.push(<Cursor />);
    const node = row[i];
    // Basis und nachfolgende Exponenten gruppieren, damit der Exponent an der Oberkante der Basis sitzt
    if (isPow(row[i + 1]) || isPow(node)) {
      const group: ComponentChildren[] = [];
      // Cursor an dieser Position wurde bereits vor der Gruppe gezeichnet
      const emittedAt = i;
      if (isPow(node)) {
        group.push(<span class="m-row m-empty m-nobase" />);
      } else {
        group.push(renderNode(node, [...prefix, i], ctx));
        i++;
      }
      while (isPow(row[i])) {
        if (cur === i && i !== emittedAt) group.push(<Cursor />);
        group.push(renderNode(row[i], [...prefix, i], ctx));
        i++;
      }
      items.push(<span class="m-pw">{group}</span>);
      continue;
    }
    items.push(renderNode(node, [...prefix, i], ctx));
    i++;
  }
  if (cur === row.length) items.push(<Cursor />);
  return (
    <span class="m-row" data-s={JSON.stringify(prefix)} data-n={row.length}>
      {items}
    </span>
  );
}

const Radical = (): VNode => (
  <svg class="m-rad" viewBox="0 0 12 24" preserveAspectRatio="none" aria-hidden="true">
    <path
      d="M0.6 14.5 L2.8 13.2 L6 22.6 L11.2 0.9 L12.6 0.9"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
);

function renderNode(node: MNode, path: number[], ctx: Ctx): VNode {
  if (node.t === 'tok') {
    const p = JSON.stringify(path);
    if (node.id === 'ᴇ') {
      return (
        <span class="m-tok m-exp" data-p={p}>
          ×<span class="m-exp10">10</span>
        </span>
      );
    }
    return (
      <span class={`m-tok m-${tokenClass(node.id)}`} data-p={p}>
        {tokenLabel(node.id, ctx.comma)}
      </span>
    );
  }
  if (node.t === 'txt') return <span class="m-txt">{node.s}</span>;
  const slot = (s: number): VNode => renderRow(node.s[s], [...path, s], ctx);
  switch (node.k) {
    case 'frac':
      return (
        <span class="m-frac">
          <span class="m-fnum">{slot(0)}</span>
          <span class="m-fden">{slot(1)}</span>
        </span>
      );
    case 'mixed':
      return (
        <span class="m-mixed">
          <span class="m-whole">{slot(0)}</span>
          <span class="m-frac">
            <span class="m-fnum">{slot(1)}</span>
            <span class="m-fden">{slot(2)}</span>
          </span>
        </span>
      );
    case 'sqrt':
      return (
        <span class="m-sqrt">
          <Radical />
          <span class="m-radicand">{slot(0)}</span>
        </span>
      );
    case 'root':
      return (
        <span class="m-root">
          <span class="m-rootidx">{slot(0)}</span>
          <span class="m-sqrt">
            <Radical />
            <span class="m-radicand">{slot(1)}</span>
          </span>
        </span>
      );
    case 'pow':
      return <span class="m-sup">{slot(0)}</span>;
    case 'abs':
      return <span class="m-abs">{slot(0)}</span>;
    case 'logb':
      return (
        <span class="m-logb">
          <span class="m-tok m-fn">log</span>
          <span class="m-sub">{slot(0)}</span>
          <span class="m-tok m-sym">(</span>
          {slot(1)}
          <span class="m-tok m-sym">)</span>
        </span>
      );
    case 'int':
      return (
        <span class="m-big m-int">
          <span class="m-bigcol">
            <span class="m-lim">{slot(2)}</span>
            <span class="m-bigsym m-intsym">∫</span>
            <span class="m-lim">{slot(1)}</span>
          </span>
          <span class="m-body">{slot(0)}</span>
          <span class="m-tok m-var m-dx">dx</span>
        </span>
      );
    case 'sum':
    case 'prod':
      return (
        <span class="m-big">
          <span class="m-bigcol">
            <span class="m-lim">{slot(2)}</span>
            <span class="m-bigsym">{node.k === 'sum' ? 'Σ' : 'Π'}</span>
            <span class="m-lim">
              <span class="m-tok m-var">x</span>
              <span class="m-tok m-op">=</span>
              {slot(1)}
            </span>
          </span>
          <span class="m-tok m-sym">(</span>
          <span class="m-body">{slot(0)}</span>
          <span class="m-tok m-sym">)</span>
        </span>
      );
    case 'diff':
      return (
        <span class="m-big m-diff">
          <span class="m-frac m-ddx">
            <span class="m-fnum">
              <span class="m-tok m-var">d</span>
            </span>
            <span class="m-fden">
              <span class="m-tok m-var">dx</span>
            </span>
          </span>
          <span class="m-tok m-sym">(</span>
          <span class="m-body">{slot(0)}</span>
          <span class="m-tok m-sym">)</span>
          <span class="m-at">
            <span class="m-tok m-var">x</span>
            <span class="m-tok m-op">=</span>
            {slot(1)}
          </span>
        </span>
      );
  }
}

export function MathView({ row, cursor = null, comma = true, onPick, class: cls }: Props): VNode {
  const pick = onPick
    ? (ev: PointerEvent) => {
        const target = ev.target as HTMLElement;
        const tokEl = target.closest('[data-p]') as HTMLElement | null;
        if (tokEl) {
          const path = JSON.parse(tokEl.dataset.p!) as number[];
          const r = tokEl.getBoundingClientRect();
          if (ev.clientX > r.left + r.width / 2) path[path.length - 1] += 1;
          onPick(path);
          return;
        }
        const slotEl = target.closest('[data-s]') as HTMLElement | null;
        if (slotEl) {
          const prefix = JSON.parse(slotEl.dataset.s!) as number[];
          const n = Number(slotEl.dataset.n ?? 0);
          const r = slotEl.getBoundingClientRect();
          // links der Mitte: Zeilenanfang, sonst Zeilenende
          onPick([...prefix, ev.clientX < r.left + r.width / 2 ? 0 : n]);
        } else {
          onPick([row.length]);
        }
      }
    : undefined;
  // nach jedem Zeichnen den Cursor in den sichtbaren Bereich holen (lange Eingaben scrollen mit)
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!cursor) return;
    const el = rootRef.current?.querySelector('.m-cursor');
    try {
      el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch {
      /* ältere Browser */
    }
  });
  return (
    <span class={`math${cls ? ` ${cls}` : ''}`} onPointerDown={pick} ref={rootRef}>
      {renderRow(row, [], { cursor, comma }, true)}
    </span>
  );
}
