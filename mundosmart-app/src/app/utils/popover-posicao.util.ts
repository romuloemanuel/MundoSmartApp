/** Estilo `position: fixed` para popover/dropdown sem ser cortado pelo overflow da grid. */
export function posicionarPopoverFixo(
  ancora: HTMLElement,
  opcoes: {
    width: number;
    height: number;
    gap?: number;
    /** start = alinhado à esquerda do botão; end = alinhado à direita */
    align?: 'start' | 'end' | 'center';
  },
): Record<string, string> {
  const gap = opcoes.gap ?? 6;
  const r = ancora.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = opcoes.width;
  const h = opcoes.height;

  let left: number;
  if (opcoes.align === 'end') {
    left = r.right - w;
  } else if (opcoes.align === 'center') {
    left = r.left + r.width / 2 - w / 2;
  } else {
    left = r.left;
  }
  left = Math.max(8, Math.min(left, vw - w - 8));

  const spaceBelow = vh - r.bottom;
  const openUp = spaceBelow < h + gap && r.top > spaceBelow;

  if (openUp) {
    return {
      position: 'fixed',
      top: 'auto',
      bottom: `${Math.max(8, vh - r.top + gap)}px`,
      left: `${left}px`,
      right: 'auto',
      zIndex: '10050',
    };
  }

  return {
    position: 'fixed',
    top: `${Math.min(r.bottom + gap, vh - h - 8)}px`,
    bottom: 'auto',
    left: `${left}px`,
    right: 'auto',
    zIndex: '10050',
  };
}
