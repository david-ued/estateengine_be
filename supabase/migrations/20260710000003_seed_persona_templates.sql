-- =====================================================================
-- 預設 Persona 範本（PRD：3-5 組，買家一鍵套用後可微調）
-- PRD 範例：小資首購族、學區家長
-- 權重維度對應前端 lib/scoring.ts 的 SCORE_DIMENSIONS
-- =====================================================================

insert into public.persona_templates (code, name, description, weights, sort_order)
values
  (
    'first_time_buyer',
    '{"en": "First-Time Buyer", "fr": "Premier acheteur", "zh-TW": "小資首購族", "zh-CN": "小资首购族"}',
    '{"en": "Commute and neighbourhood value first — practical picks for a first home.", "fr": "Trajets et rapport qualité-prix du quartier d''abord.", "zh-TW": "通勤與生活機能優先，務實入手第一間房。", "zh-CN": "通勤与生活配套优先，务实入手第一套房。"}',
    '{"transit": 35, "environment": 30, "material": 20, "school": 15}',
    1
  ),
  (
    'school_parent',
    '{"en": "School-District Parent", "fr": "Parent secteur scolaire", "zh-TW": "學區家長", "zh-CN": "学区家长"}',
    '{"en": "Top catchment schools matter most, then commute and neighbourhood.", "fr": "Les écoles avant tout, puis les transports et le quartier.", "zh-TW": "學區優先，其次是通勤與生活環境。", "zh-CN": "学区优先，其次是通勤与生活环境。"}',
    '{"school": 50, "transit": 20, "environment": 20, "material": 10}',
    2
  ),
  (
    'quality_seeker',
    '{"en": "Build-Quality Seeker", "fr": "Exigeant sur la construction", "zh-TW": "建商品質控", "zh-CN": "建商品质控"}',
    '{"en": "Builder reputation and materials above all.", "fr": "Réputation du constructeur et matériaux avant tout.", "zh-TW": "建商評價與建材品質至上。", "zh-CN": "建商口碑与建材质量至上。"}',
    '{"material": 40, "environment": 25, "transit": 25, "school": 10}',
    3
  ),
  (
    'feng_shui_believer',
    '{"en": "Feng Shui Believer", "fr": "Adepte du feng shui", "zh-TW": "風水優先", "zh-CN": "风水优先"}',
    '{"en": "Orientation and feng shui lead the decision.", "fr": "Orientation et feng shui guident le choix.", "zh-TW": "座向與風水是首要考量。", "zh-CN": "朝向与风水是首要考量。"}',
    '{"feng_shui": 40, "environment": 20, "school": 20, "transit": 20}',
    4
  ),
  (
    'balanced',
    '{"en": "Balanced Buyer", "fr": "Acheteur équilibré", "zh-TW": "均衡型買家", "zh-CN": "均衡型买家"}',
    '{"en": "Every dimension weighted equally.", "fr": "Tous les critères comptent autant.", "zh-TW": "各條件平均考量。", "zh-CN": "各条件平均考量。"}',
    '{"school": 20, "transit": 20, "material": 20, "feng_shui": 20, "environment": 20}',
    5
  )
on conflict (code) do nothing;
