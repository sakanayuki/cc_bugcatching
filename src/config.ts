// ゲーム全体の調整用定数。値を変えるだけでバランス調整できるようにここへ集約する。

/** 内部解像度とレイアウト */
export const VIEW = {
  /** ゲーム領域の高さ（固定） */
  height: 640,
  /** 縦長端末での幅（最小幅） */
  minWidth: 360,
  /** 横長端末での最大幅（16:9） */
  maxWidth: 1138,
} as const;

/** ゲーム領域内の地形の高さ（y 座標, 0 = 上端） */
export const TERRAIN = {
  canopyBottom: 170,
  trunkTop: 150,
  groundTop: 440,
  /** 主人公が立つ足元の y */
  heroFeetY: 548,
  /** 操作パネル（地面の下の土）の上端 */
  panelTop: 566,
} as const;

/** ロジック更新の固定ステップ（秒） */
export const FIXED_DT = 1 / 120;
/** 1 フレームで進める最大時間（タブ復帰時などの暴走防止） */
export const MAX_FRAME_DT = 0.1;

/** 虫取り網 */
export const NET = {
  /** この時間以内に離せばタップとみなし、すぐ近くへ網を振る（秒） */
  tapTime: 0.2,
  /** ゲージが 空 → 満タン → 空 と 1 往復する時間（秒） */
  gaugePeriod: 2.0,
  /** 到達距離（網の支点から真上へ, px） */
  minReach: 40,
  maxReach: 460,
  /** 離してから到達点に届くまでの時間（秒）。距離に応じて線形補間 */
  minSwingTime: 0.15,
  maxSwingTime: 0.35,
  /** 到達点で網を止めておく時間（判定あり, 秒） */
  holdTime: 0.3,
  /** 振り終わりの硬直時間（秒）。この間に網を戻す */
  recoverTime: 0.2,
  /** スイング進行度がこの値以上で捕獲判定を行う */
  hitWindowStart: 0.35,
  /** 網の輪の内側の半径 */
  ringRadius: 30,
  /** 構えているときの柄の長さ */
  restLength: 36,
  /** 構えの角度（度, 0 = 右, -90 = 真上） */
  readyAngle: -60,
  /** 最大まで振りかぶったときの角度 */
  windupAngle: 35,
  /** 1 ロジックステップ内で判定を行う分割数（高速スイングのすり抜け防止） */
  hitSubsteps: 4,
} as const;

/** 少年の横に出すゲージの大きさ */
export const GAUGE = {
  width: 10,
  height: 72,
  /** 少年との間隔 */
  gap: 6,
} as const;

/** 虫の当たり判定は見た目の何割か（3 歳児向けに見た目いっぱいまで） */
export const BUG_HIT_SCALE = 1.0;

/** 虫のドット絵の表示倍率（スプライト 1px を何 px で描くか） */
export const BUG_SCALE = 2;

/** 虫の動きの速さの倍率。1 未満で全体をゆっくりにする（移動・停止・滞在時間すべて） */
export const BUG_SPEED_SCALE = 0.6;

/** プレイ時間と時間帯 */
export const TIME = {
  /** 制限時間（秒） */
  playTime: 90,
  /** 各時間帯の開始（経過秒） */
  duskStart: 30,
  nightStart: 60,
  /** 時間帯の切替にかける時間（秒） */
  transitionTime: 4,
  /** 残り時間がこの秒数以下で警告表示・カウント音 */
  warningTime: 10,
} as const;

/** 捕獲と GET 演出 */
export const CATCH = {
  /** 捕獲直後に網の中で静止する時間（秒） */
  freezeTime: 0.4,
  /** GET 演出の長さ（秒） */
  getTime: 1.0,
  /** GET 演出でスキップを受け付けるまでの時間（秒） */
  getSkipDelay: 0.15,
  /** GET 演出での虫の拡大倍率 */
  getScale: 6,
} as const;

/** 虫の出現 */
export const SPAWN = {
  /** 幅 360 あたりの常時匹数の範囲 */
  minPer360: 6,
  maxPer360: 8,
  /** 虫が消えてから補充するまでの時間（秒） */
  minRespawnDelay: 0.3,
  maxRespawnDelay: 1.0,
  /** 画面端ではなく、草むらや木の裏から出てくる割合 */
  hiddenSpawnChance: 0.75,
  /** 草むら・木の裏から出てくるとき、中央（主人公の真上）からの距離の範囲 */
  hiddenSpawnMinOffset: 50,
  hiddenSpawnMaxOffset: 200,
  /** 草むら・木の裏から出てくるときのフェードインの時間（秒） */
  appearTime: 0.5,
  /** 滞在中の虫が動き回る範囲（中央からの距離 = 画面幅 × この値）。中央レーンを横切りやすくする */
  roamRatio: 1 / 3,
  /** 飛び移る虫が中央の木を選ぶ確率 */
  centerTrunkChance: 0.6,
  /** 時間帯外になった虫が退場を始めるまでの猶予（秒） */
  minLeaveDelay: 0.5,
  maxLeaveDelay: 3.5,
} as const;

/** レア度（★1〜★4）の下限得点 */
export const RARITY_THRESHOLDS = [0, 50, 120, 300] as const;

/** リザルト画面でタップを受け付けるまでの時間（秒） */
export const RESULT_INPUT_DELAY = 1.0;

/** 振動パターン（ms） */
export const VIBRATION = {
  swing: 12,
  catch: [25, 40, 35] as number[],
} as const;

/** UI */
export const UI = {
  margin: 8,
  buttonRadius: 26,
  muteSize: 24,
  font: '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
  /** フォント読み込みを待つ最大時間（ms） */
  fontTimeout: 3000,
} as const;

/** localStorage のキー */
export const STORAGE_KEYS = {
  highScore: 'mushitori.highScore',
  muted: 'mushitori.muted',
} as const;
