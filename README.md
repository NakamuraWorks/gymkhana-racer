# Gymkhana Racer

ブラウザベースのジムカーナレーシングゲーム。Phaser 3 + Matter.js で構築されており、実在のジムカーナコースを再現したドリフト走行が可能です。

## 動作環境

- Node.js 18 以上
- モダンブラウザ（Chrome, Firefox, Safari, Edge）

## インストール

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスしてください。

## ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに出力されます。

## コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバーを起動 |
| `npm run build` | 本番ビルド |
| `npm run preview` | ビルド成果物をローカルで確認 |
| `npm run lint` | ESLint でコードチェック |
| `npm run test` | Vitest でユニットテストを実行 |
| `npm run test:watch` | テストをウォッチモードで実行 |

## 操作方法

| 入力 | 動作 |
|-----|------|
| `←` `→` キー | ステアリング |
| `X` キー | アクセル |
| `Z` キー | ブレーキ / 後進 |
| ゲームパッド左スティック | ステアリング |
| ゲームパッドボタン 0 (A/◯) | アクセル |
| ゲームパッドボタン 2 (B/×) | ブレーキ / 後進 |

## コース

- **Tomin Motorland** — 富みんモータースポーツランド
- **Okegawa SportsLand** — 鷲宫スポーツランド

## プロジェクト構造

```
├── index.html            # エントリポイント
├── package.json
├── vite.config.js
├── public/               # アセット（画像、SVG コースデータ）
│   ├── tomin/
│   └── okspo/
└── src/
    ├── constants.js      # 全定数（物理パラメータなど）
    ├── main.js           # GameScene（Phaser.Scene）
    ├── menu.js           # メニュー画面
    ├── carPhysics.js     # 車両物理演算
    ├── inputManager.js   # キーボード / ゲームパッド入力
    ├── lapManager.js     # ラップタイム管理
    ├── smokeManager.js   # ドリフトスモークエフェクト
    ├── stabilization.js  # 直進安定化アルゴリズム
    ├── svgUtils.js       # SVG コースデータパーサー
    └── __tests__/        # ユニットテスト
```

## コースの追加方法

1. `public/` 下にコース ID 名でディレクトリを作成（例: `public/mycourse/`）
2. 背景画像を `mycourse/background.png` として配置（推奨解像度: 3840x2160）
3. コリジョンデータを `mycourse/collision.svg` として配置
   - `<path id="collisionInner">` — コース内側境界
   - `<path id="collisionOuter">` — コース外側境界
   - `<line id="startFinishLine">` — スタート/フィニッシュライン
   - `<line id="checkpoint1">` — チェックポイント1
   - `<line id="checkpoint2">` — チェックポイント2
   - `<circle id="spawn">` — 車のスポーン位置
4. `src/menu.js` の `courses` 配列にコースを追加

## ライセンス

MIT

## 貢献

Issue や Pull Request を歓迎します。