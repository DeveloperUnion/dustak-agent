# TODO

## チップ自由入力: enum外の値のバリデーション

チップ質問に自由テキスト入力欄を追加した（LLM Extractor 経由で処理）。
現状、LLMがenum外の値を返した場合はそのまま受け入れる。

### 将来的な対応案
- サーバー側で slotPatch の enum フィールドを検証し、不正値を拒否
- enum外なら最近似の enum 値にマッピングしてユーザーに確認（例: 「工場 → その他 としてよいですか？」）
- または再質問（「選択肢から選んでください」）

### 関連ファイル
- `src/app/api/chat/route.ts` — slotPatch 適用前にバリデーション挿入
- `src/lib/slots/types.ts` — enum 定義
- `src/lib/llm/prompts.ts` — Extractor プロンプト（enum値は既に記載済み）
