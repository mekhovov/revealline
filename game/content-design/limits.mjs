// Shared source envelope, not a shipped-content target. Draft storage deliberately
// accepts incomplete designs; only the compiler validates gameplay/membership.
export const CONTENT_PROJECT_JSON_LIMITS = Object.freeze({
  maxBytes: 4 * 1024 * 1024,
  maxNodes: 100000,
  maxDepth: 20,
  maxArray: 512,
});
// 242 Solo candidates + 12 Remixes + 12 explicit Team missions must fit together,
// with bounded room for authoring copies. No parser/media budget is increased.
export const CONTENT_PROJECT_ITEM_LIMITS = Object.freeze({
  maps: 512,
  missions: 384,
  campaigns: 64,
  packs: 64,
  assets: 512,
});
