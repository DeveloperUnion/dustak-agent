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
