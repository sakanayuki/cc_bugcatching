# むしとり

スマホ縦画面向けの 2D ドット絵虫取りゲーム。長押しで網を振りかぶり、離して振る。90 秒の間に昼 → 夕方 → 夜と時間帯が移り変わる。

- 遊ぶ: https://sakanayuki.github.io/cc_bugcatching/
- 仕様: [docs/SPEC.md](docs/SPEC.md) / 補足と決定事項: [docs/DECISIONS.md](docs/DECISIONS.md)

## 開発

Node 24（`.nvmrc`）と npm を使う。

```sh
npm ci
npm run dev        # 開発サーバー
npm run typecheck  # 型チェック
npm test           # ユニットテスト（Vitest）
npm run build      # dist/ に出力
npm run test:e2e   # Playwright スモークテスト（初回は npx playwright install chromium）
```

調整用の定数は `src/config.ts`（網・時間・出現数など）と `src/bugs.ts`（虫ごとの得点・動き・出現率）にまとめてある。

## デプロイ

`main` への push で GitHub Actions が 型チェック → テスト → ビルド → GitHub Pages へのデプロイを行う。PR ではデプロイ以外を実行する。

初回のみ、リポジトリの Settings → Pages → Source を「GitHub Actions」にしておく必要がある。
