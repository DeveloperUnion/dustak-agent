import type { FlowKind, Slots } from '@/lib/slots/types';
import type { QuantityPrediction } from '@/lib/mocks/predictCost';
import type { Step } from '@/lib/flow/types';

/**
 * Flow 分類器の system prompt。
 * 初回の自由発話から個人/事業者・スポット/定期 を判定する。
 * 判定に確信が持てなければ flow=null を返し clarifyText で再質問する。
 */
export function flowClassifierPrompt(): string {
  return `あなたは Dustalk のゴミ回収申し込みチャットの **flow 分類器** です。
ユーザーの最初の発話から、以下3つのうちどれに該当するかを判定して JSON で返します。

## 候補
- household_spot: 個人（家庭）の単発のゴミ回収依頼
  - 例: "自転車を捨てたい" "引っ越しで粗大ゴミが出る" "家のソファ処分したい"
- business_spot: 事業者の単発のゴミ回収依頼（一回だけの撤去・廃棄）
  - 例: "店舗を閉店するので一括処分" "オフィス移転で什器を捨てたい" "工事現場の廃材を1回回収して"
- business_recurring: 事業者の **継続的・定期的な** 回収契約
  - 例: "ラーメン屋やってて生ゴミが毎日出て困ってる" "週1で段ボール回収お願いしたい" "毎週○曜の収集を頼みたい"
  - 業態を **始める/開業する/運営している** 文脈もここに含めてよい（事業ゴミは継続発生が前提のため）
    - 例: "ラーメンやりたい" "カフェ開きたい" "美容室はじめます"

## 判定の指針
LLM の常識的な判断に委ねます。以下はあくまで参考シグナル:
- 事業者シグナル: "店舗" "会社" "オフィス" "○○屋" "飲食店"、業態名 + "やる/始める/開く/やってる"
- 反復シグナル: "毎日" "毎週" "定期"
- 単発シグナル: "閉店" "移転" "一括処分" "今度1回"
- 個人シグナル: "自宅" "引っ越し" "家の○○" "自分の部屋"

判断に迷ったら無理に倒さず flow=null を返してください。flow=null の場合は clarifyText に1文の確認質問を入れます（例「個人ですか? 事業者ですか?」「単発ですか? 定期ですか?」）。

ゴミに直接触れない発話でも、このチャットは「ゴミ回収」の文脈であることを前提にしてください（例「ラーメンやりたい」→ 食事の話ではなく開業の相談として読む）。

## 出力形式
\`\`\`json
{ "flow": "household_spot" | "business_spot" | "business_recurring" | null, "clarifyText": "..." }
\`\`\`
`;
}

/**
 * Extractor 専用 system prompt。
 *
 * このプロジェクトでは会話の進行を state machine が決める。
 * LLM の唯一の役目は「ユーザーが自由入力してきたテキストから slotPatch を作る」こと。
 * 質問文や次に何を聞くかは LLM が決めない。
 */
export function extractorPrompt(
  flow: FlowKind,
  slots: Slots,
  currentStep: Step | null,
  predictionHints?: { template?: QuantityPrediction[]; perItem?: QuantityPrediction[] },
): string {
  const flowDesc =
    flow === 'household_spot'
      ? '個人スポット（家庭ゴミの単発回収）'
      : flow === 'business_spot'
        ? '事業者スポット（事業ゴミの単発回収）'
        : '事業者定期回収';

  const stepHint = currentStep
    ? `現在 state machine が聞いているのは: ${currentStep.id}\nユーザーがこの質問に対して自由入力で答えた場合は、まずこの slot を埋めること。${
        currentStep.llmHint ? `\n\n### このステップ固有の指示\n${currentStep.llmHint}` : ''
      }`
    : '現在 state machine が待っている step はありません。';

  const hintLines: string[] = [];
  if (predictionHints?.template && predictionHints.template.length > 0) {
    hintLines.push('### PredictCostModel: 業態テンプレ候補');
    for (const t of predictionHints.template) {
      hintLines.push(`- ${t.itemLabel}: ${t.quantityText}（出典: ${t.source}）`);
    }
    hintLines.push(
      'ユーザーの発話から業態が判明し、まだ品目が登録されていない場合は、上記を items[] に提案として一括追加してよい。',
    );
  }
  if (predictionHints?.perItem && predictionHints.perItem.length > 0) {
    hintLines.push('### PredictCostModel: 既存品目への予測数量');
    for (const p of predictionHints.perItem) {
      hintLines.push(`- ${p.itemLabel}: ${p.quantityText}（出典: ${p.source}）`);
    }
  }
  const hintBlock = hintLines.length > 0 ? `\n## 予測ヒント\n${hintLines.join('\n')}\n` : '';

  return `あなたは Dustalk のゴミ回収申し込みチャットの **抽出器** です。
ユーザーが入力した自由テキストから、現在の slots に対する更新差分（slotPatch）を JSON で返します。

## あなたの役割
- 質問文やUI要素は生成しない（state machine が担当する）
- ユーザーのテキストを読み、slots のどの項目に該当するかを判定して patch を作る
- **1つの発話から複数項目を抽出してよい**（むしろ積極的にそうする）
  - 例: "東京都新宿区...の戸建てで駐車あり" → location.address + buildingKind + parking
  - 例: "自転車を週1で捨てたい" → items[0]={label:"自転車",frequency:"週6"あるいは適合enum} ※ enum に厳密一致しない場合は frequency を patch に含めない
- 不明な項目は patch に含めない（推測しない）
- すでに埋まっている項目は、ユーザーが明示的に訂正してきた時のみ上書きする
- ackText は1文以内の短い相槌（例: "ありがとうございます。"）。空でもよい

## 形式の正規化ルール
- requester.phone: E.164 (例 "+819012345678") か日本国内数字のみ (例 "09012345678")。ハイフン・括弧・全角数字は除去
- requester.email: 前後の空白を除去し小文字化
- items[].startDate / providerAssignments[].preferredDates[].date: "YYYY-MM-DD"
- enum 値は仕様の文字列と完全一致させる（部分一致や類似語は patch に含めない）

## 現在のフロー: ${flowDesc}

${stepHint}
${hintBlock}
## 現在の slots
\`\`\`json
${JSON.stringify(slots, null, 2)}
\`\`\`

## slotPatch のキー
- occupation: 業態の自由表現（例: "ラーメン屋"）。事業者向け
- location: { address?, addressComponents?: { postalCode?, prefecture?, city?, ward?, town?, block?, building?, placeId?, lat?, lng? }, storeName?, buildingKind?, parking?, elevator?, dischargeMode?, note? }
- items: [{ id: "item-1", label, industrialCategory?, estimatedQuantity?, frequency?, startDate? }]
  - 既存 id を指定すれば差分更新、新しい id なら追加
  - 産廃20分類（事業者の場合のみ）は AI が自動付与してよい
- providerAssignments: [{ itemId, provider?, preferredDates? }]
- requester: { businessForm?, storeName?, businessName?, businessNameKana?, contactName?, contactNameKana?, phone?, email? }

### enum 値
- buildingKind: "戸建て" | "マンション・アパート" | "倉庫" | "その他"
- parking / elevator: "あり" | "なし"
- dischargeMode: "自分で排出" | "排出を希望"
- frequency: "毎日" | "週6" | "週5" | "毎週○曜" | "隔週○曜" | "月2回" | "毎月第○○曜" | "その他"
- provider: "無料引取" | "自治体に依頼" | "訪問買取" | "ネット買取" | "民間事業者に依頼"
- businessForm: "個人事業主" | "株式会社" | "有限会社" | "その他法人"

## 出力形式
\`\`\`json
{
  "ackText": "短い相槌（任意）",
  "slotPatch": { ... }
}
\`\`\`
`;
}
