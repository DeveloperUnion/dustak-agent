// Extractor 用 JSON Schema。
// LLM は { ackText?, slotPatch } のみを返す。
// 質問文やUI要素は state machine が担当するためここには含まれない。

export const EXTRACTOR_JSON_SCHEMA = {
  name: 'DustalkExtractor',
  strict: false,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['slotPatch'],
    properties: {
      ackText: {
        type: 'string',
        description: '短い相槌（1文以内）。空でもよい。',
      },
      slotPatch: {
        type: 'object',
        description:
          'ユーザー発話から抽出した slots の差分。判明していない項目は省略する。配列は id ごとに upsert される。',
        additionalProperties: true,
      },
    },
  },
} as const;

// Flow 分類器の JSON Schema。
// 自由発話の最初の1ターンで「個人スポット / 事業者スポット / 事業者定期」のどれに該当するかを判定する。
// 判定不能なら flow=null + clarifyText で確認質問を返す。
export const FLOW_CLASSIFIER_JSON_SCHEMA = {
  name: 'DustalkFlowClassifier',
  strict: false,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['flow'],
    properties: {
      flow: {
        anyOf: [
          { type: 'string', enum: ['household_spot', 'business_spot', 'business_recurring'] },
          { type: 'null' },
        ],
        description:
          '判定された flow。確信が持てなければ null を返す（chips fallback で確認する）。',
      },
      clarifyText: {
        type: 'string',
        description:
          'flow=null のときに表示する短い確認質問（1文）。例: "個人のお客様ですか? 事業者のお客様ですか?"',
      },
    },
  },
} as const;
