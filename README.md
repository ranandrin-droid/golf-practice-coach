# Golf Practice Coach PWA

iPhone Safariで使うためのPWAです。

## 主な機能
- AW / PW / 7I / 4UT / Driver の切替
- 1球1タップ記録
- 左 / 中央 / 右 × 良 / 普通 / 悪
- トップ / ダフリ
- 100球進捗
- クラブ別の中央率・良い当たり率
- 今日の感覚メモ
- 練習履歴
- ChatGPT用レポート自動生成
- コピー / iOS共有
- オフライン対応
- iPhoneのホーム画面追加対応

## iPhoneで使うには
PWAはHTTPSで配信する必要があります。
GitHub Pages / Netlify / Cloudflare Pages などの静的ホスティングにこのフォルダをアップロードしてください。

Safariで公開URLを開き、
共有ボタン → 「ホーム画面に追加」
でアプリのように使えます。

## データ保存
記録はブラウザの localStorage に保存します。
サーバーには送信しません。
Safariのサイトデータを削除すると記録も消えるため、将来版ではエクスポート機能追加を推奨します。
