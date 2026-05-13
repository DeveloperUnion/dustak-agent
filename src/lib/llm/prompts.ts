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

## 大原則（最重要）
flow を確定するには、**文中に「個人 signal」または「事業 signal」が含まれていること** が必要です。
どちらの signal も無いただの依頼文（例: 「粗大ゴミ捨てたい」「不用品の回収お願い」「ゴミ処分したい」「自転車捨てたい」）は **必ず flow=null** を返してください。
品目だけ・「捨てたい/処分したい/回収お願い」系の動詞だけ・「粗大ゴミ/不用品/ゴミ」のような総称ワードだけ、では分類しません。

## 候補
- household_spot: 個人（家庭）の単発のゴミ回収依頼
  - **明確な個人 signal が必要**: "自宅" "家の○○" "自分の部屋" "引っ越し" "アパート住まい" "実家" など
  - 例: "自宅のソファを捨てたい" "引っ越しで部屋の家具を処分したい" "家のベッドを引き取ってほしい"
- business_spot: 事業者の単発のゴミ回収依頼（一回だけの撤去・廃棄）
  - **明確な事業 signal が必要**: "店舗" "事務所" "オフィス" "会社"、業態名（"○○屋" "飲食店" "美容室" 等）、"閉店" "移転" "一括処分" など
  - 例: "店舗を閉店するので一括処分" "オフィス移転で什器を捨てたい" "工事現場の廃材を1回回収して"
- business_recurring: 事業者の **継続的・定期的な** 回収契約
  - 事業 signal + 反復 signal（"毎日" "毎週" "定期" "週○回"）、もしくは業態を **始める/開業する/運営している** 文脈
  - 例: "ラーメン屋やってて生ゴミが毎日出て困ってる" "週1で段ボール回収お願いしたい" "ラーメンやりたい" "カフェ開きたい"

## 曖昧キーワード（これだけでは判定しない）
以下の語が **個人/事業 signal を伴わずに単独で出てきた** 場合、必ず flow=null を返してください:
- 総称ワード: "粗大ゴミ" "不用品" "ゴミ" "廃棄物"
- 動詞だけ: "捨てたい" "処分したい" "回収お願い" "引き取ってほしい"
- 品目名だけ: "自転車" "ソファ" "冷蔵庫" "机" など（家庭でも事業でも出るもの）

例外: その品目が **明らかに事業特有**（厨房機器・什器・産廃系資材など）なら business 寄りに倒してよい。

## flow=null のときの clarifyText
1文で、後続の3択 chips（個人スポット / 事業者スポット / 事業者定期回収）に整合する確認文にしてください。
- 推奨パターン: "個人のお客様ですか? それとも事業者ですか?（事業者の場合は単発か定期かも教えてください）"
- 状況に応じて文言は調整してよい（例: 業態らしき語が一部含まれていれば「事業者の場合、単発ですか? 定期ですか?」だけでもよい）

## 補足
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
- ackText は短い相槌または**補助説明**に使える（例: "ありがとうございます。" / "一般的には〜ですが近いですか?"）。空でもよい
- **ユーザーが質問や不明(「わからない」「どのくらい？」「教えて」)で返してきた場合**: patch は埋めず、ackText に予測ヒントや言い換え提案を入れて help する（同じ step が再表示されるので会話が前に進む）

## items[] への追加ルール（重要）
新規に items[] を追加するときは、必ず以下を守ってください:
- **label は具体的な品目名のみ**。物の正体が特定できる名詞を入れる
  - OK 例: "ソファ" "自転車" "冷蔵庫" "ベッド" "段ボール" "生ゴミ" "ロッカー" "椅子"
  - NG 例: "粗大ゴミ" "不用品" "ゴミ" "廃棄物" "回収品" "もの" "あれ" "それ"（総称・指示語のみ）
- ユーザーが **総称ワード単独** （例: 「粗大ゴミ捨てたい」「不用品の回収お願い」「ゴミを処分したい」）で発話した場合、**items は patch に含めない**（state machine が後で「捨てたいものを教えてください」と具体的に聞き直すため）
- label が決まらないなら、そもそもその item entry を patch に出さない（id だけの空の entry も作らない）
- 同様に、「○○など」「いろいろ」のような数量・品目が曖昧な発話だけで具体的な品目が特定できない場合も items は埋めない

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
- location: { address?, addressComponents?: { postalCode?, prefecture?, city?, ward?, town?, block?, building?, placeId?, lat?, lng? }, storeName?, buildingKind?, floor?, parking?, elevator?, dischargeMode?, note? }
  - floor: 回収品の置き場の階。"1階" "2階" "3階" "4階以上" のいずれかか、自由表現（"地下1階" 等）でもよい。
- items: [{ id: "item-1", label, industrialCategory?, estimatedQuantity?, frequency?, startDate?, manufacturer?, yearOfManufacture?, capacity? }]
  - 既存 id を指定すれば差分更新、新しい id なら追加
  - 産廃20分類（事業者の場合のみ）は AI が自動付与してよい
  - manufacturer / yearOfManufacture / capacity は家電など無料引取候補の付帯情報。
    画像検知テキストの "(メーカー: ..., 年式: ..., 容量: ...)" や、ユーザー発話から拾えれば該当品目に詰めてよい。
- providerAssignments: [{ itemId, provider?, preferredDates? }]
- requester: { businessForm?, storeName?, businessName?, businessNameKana?, contactName?, contactNameKana?, phone?, email? }

### enum 値
- buildingKind:
  - 個人(household_spot): "戸建て" | "マンション・アパート" | "倉庫" | "その他"
  - 事業(business_spot / business_recurring): "路面店・独立店舗" | "ビル内テナント・事務所" | "商業施設内" | "工場・倉庫" | "その他"
  - フローに合わない値（個人で「ビル内テナント」、事業で「マンション・アパート」など）は patch に含めない。判断が付かなければ "その他" を選ぶか、含めない。
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
