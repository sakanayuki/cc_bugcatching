// 入力: 画面のどこをタップ・長押ししても同じ操作。マウスとスペースキーにも対応。

export interface PressInfo {
  /** 押し始めた位置（キャンバスの内部座標）。キーボードなら null */
  x: number | null;
  y: number | null;
}

export class Input {
  private pointers = new Set<number>();
  private keyDown = false;
  /** 押し始めるたびに増える番号 */
  private pressId = 0;
  /** 網操作に使わない（消費済み）押下の番号 */
  private consumedId = -1;
  /** 未処理の押し始めイベント */
  private presses: PressInfo[] = [];

  constructor(
    private target: HTMLElement,
    private toCanvas: (clientX: number, clientY: number) => { x: number; y: number },
    private onKey: (key: string) => void,
  ) {
    target.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.reset);
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** 押されているか */
  get down(): boolean {
    return this.pointers.size > 0 || this.keyDown;
  }

  /** 網操作として有効な押下が続いているか */
  get held(): boolean {
    return this.down && this.pressId !== this.consumedId;
  }

  /** 現在の押下を網操作に使わないようにする（離すまで無効） */
  consume(): void {
    if (this.down) this.consumedId = this.pressId;
  }

  /** 押し始めイベントを取り出す */
  takePresses(): PressInfo[] {
    const p = this.presses;
    this.presses = [];
    return p;
  }

  private begin(info: PressInfo): void {
    if (!this.down) this.pressId++;
    this.presses.push(info);
  }

  private onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const p = this.toCanvas(e.clientX, e.clientY);
    this.begin({ x: p.x, y: p.y });
    this.pointers.add(e.pointerId);
    try {
      this.target.setPointerCapture(e.pointerId);
    } catch {
      // 一部ブラウザでは失敗することがある
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat || this.keyDown) return;
      this.begin({ x: null, y: null });
      this.keyDown = true;
      return;
    }
    if (!e.repeat) this.onKey(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') this.keyDown = false;
  };

  /** フォーカスが外れたら押下状態を解除する */
  reset = () => {
    this.pointers.clear();
    this.keyDown = false;
  };
}
