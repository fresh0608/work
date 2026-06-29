import { createServer as createHttpServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_ROOT = join(APP_ROOT, 'public');
const DEFAULT_STORE_PATH =
  typeof process !== 'undefined' && process.env?.DATA_FILE
    ? process.env.DATA_FILE
    : join(APP_ROOT, 'data', 'responses.json');
const ADMIN_PASSWORD =
  typeof process !== 'undefined' && process.env?.ADMIN_PASSWORD ? process.env.ADMIN_PASSWORD : 'admin123';
const ADMIN_SESSION = createHash('sha256').update(`operator-survey:${ADMIN_PASSWORD}`).digest('hex');

export const FEATURES = [
  {
    name: '朋友圈私域运营功能',
    group: 'AI 私域运营平台',
    description: '集中查看企业号朋友圈动态，识别点赞、评论互动，并支持评论回复、私聊触达和标记已处理。',
    aiRelated: true,
    questions: [
      q('moments_interaction_fit', '能把点赞、评论里的高意向客户识别出来', 'businessUnderstanding'),
      q('moments_process_closed', '能把回复、私聊触达、标记完成之间的处理关系设计清楚', 'architectureDesign'),
      q('moments_daily_use', '入口、信息阅读和处理动作的路径足够顺手', 'userExperience'),
    ],
    problemOptions: ['互动识别不准', '处理闭环不够清楚', '入口不好找', '容易漏处理', '暂无明显问题'],
  },
  {
    name: '私聊会话自定义分组功能',
    group: 'AI 私域运营平台',
    description: '按 AI 工作流名称和输出字段创建私聊会话分组，用于筛选特定意向或需人工介入的客户会话。',
    aiRelated: true,
    questions: [
      q('chat_group_condition_fit', '分组条件能准确筛出运营真正要跟进的会话', 'businessUnderstanding'),
      q('chat_group_rule_clear', '会话进入、留在、移出分组的依据展示清楚', 'architectureDesign'),
      q('chat_group_efficiency', '分组后的会话查找和跟进优先级更容易判断', 'userExperience'),
    ],
    problemOptions: ['分组条件难懂', '筛选不够准', '删除/移出规则不清楚', '使用价值不明显', '暂无明显问题'],
  },
  {
    name: '动态策略组',
    group: '投放系统',
    description: '按广告、账户或落地页配置多阶段、多转化事件回传策略，系统自动流转并执行规则。',
    aiRelated: false,
    questions: [
      q('strategy_goal_fit', '每个策略阶段的目标、触发条件和预期效果表达清楚', 'businessUnderstanding'),
      q('strategy_flow_control', '阶段切换原因、切换时间和兜底动作展示清楚', 'architectureDesign'),
      q('strategy_config_usable', '广告、账户、落地页、转化事件的配置顺序和依赖关系清楚', 'userExperience'),
    ],
    problemOptions: ['目标不贴合投放', '自动流转不够可控', '配置太复杂', '不同平台规则难理解', '暂无明显问题'],
  },
  {
    name: '人群圈选 Skill',
    group: 'Skill 能力',
    description: '接入 CDP 标签、人群包，支持按条件组合圈选目标人群。',
    aiRelated: true,
    questions: [
      q('people_selection_language', '自然语言描述能被转成准确的人群圈选条件', 'aiKnowledge'),
      q('people_selection_data', '常用人群条件在标签、人群包和筛选项里覆盖充分', 'productDesign'),
      q('people_selection_explain', '圈选结果能解释命中了哪些条件、排除了哪些人', 'architectureDesign'),
    ],
    problemOptions: ['听不懂运营表达', '数据覆盖不够', '圈选结果不可信', '条件组合难理解', '暂无明显问题'],
  },
  {
    name: '交付群圈选 Skill',
    group: 'Skill 能力',
    description: '根据交付目标选择或匹配交付群、服务群。',
    aiRelated: true,
    questions: [
      q('group_selection_fit', '推荐/圈选出的交付群能匹配实际要服务的客户', 'businessUnderstanding'),
      q('group_selection_rule', '选群结果能暴露错群、漏群和重复群等风险', 'architectureDesign'),
      q('group_selection_operation', '确认、调整、替换交付群的操作路径足够顺手', 'userExperience'),
    ],
    problemOptions: ['选群不准', '选群依据不清楚', '调整方式不清楚', '容易错群漏群', '暂无明显问题'],
  },
  {
    name: '私聊/群聊/朋友圈触达与内容模板 Skill',
    group: 'Skill 能力',
    description: '支持内容模板生成，并在私聊、群聊、朋友圈等渠道触达客户。',
    aiRelated: true,
    questions: [
      q('touch_template_quality', '内容模板接近运营可直接使用的表达', 'aiKnowledge'),
      q('touch_channel_fit', '模板能针对私聊、群聊、朋友圈给出差异化内容和触达限制提示', 'productDesign'),
      q('touch_sender_city_rule', '发送人、城市、通道等设置符合实际运营管理规则', 'architectureDesign'),
    ],
    problemOptions: ['模板不好用', '渠道差异不清楚', '发送规则不清楚', '触达效果不可控', '暂无明显问题'],
  },
  {
    name: 'C 端选房师一期',
    group: 'C 端产品',
    description: 'C 端工作流切换为 Agent 模式，搭建 Agent 框架和 Skill 范围，提升回复效果并降低成本。',
    aiRelated: true,
    questions: [
      q('buyer_agent_answer', 'AI 对预算、区域、通勤、楼盘对比等核心问题的回答有参考价值', 'aiKnowledge'),
      q('buyer_agent_scope', '连续追问时，AI 能围绕选房决策继续补充有效信息', 'productDesign'),
      q('buyer_agent_handoff', 'AI 回答边界、推荐依据和不确定内容提示清楚', 'architectureDesign'),
    ],
    problemOptions: ['回答不够准', '场景覆盖不够', '转人工不清楚', '客户体验不稳定', '暂无明显问题'],
  },
  {
    name: 'AI 有客商业化能力建设',
    group: '商业化',
    description: '支持分销中介购买 AI 有客套餐，对接经管、合同和履约平台，保障财务合规与线索交付。',
    aiRelated: true,
    questions: [
      q('commercial_package_fit', '页面里的套餐信息、购买对象和权益内容，能不能让运营快速核对客户买的是哪一类套餐？', 'businessUnderstanding'),
      q('commercial_chain_complete', '运营在处理购买后开通、履约和线索交付时，系统能不能减少反复查信息、问人确认或手工核对？', 'productDesign'),
      q('commercial_rule_clear', '套餐生效、线索发放、交付异常这些状态变化，系统里有没有足够的记录方便追踪和对账？', 'architectureDesign'),
    ],
    problemOptions: ['购买入口不清楚', '套餐规则难理解', '购买后交付对不上', '合同/财务问题不知道找谁', '暂无明显问题'],
  },
  {
    name: '线索卡片分配弹窗优化调整',
    group: '线索分配',
    description: '优化线索分配弹窗布局，补充经纪人已分配数量、可分配数量、到期时间、板块筛选等。',
    aiRelated: false,
    questions: [
      q('assign_popup_info_help', '新增信息能突出分配决策真正需要看的关键依据', 'businessUnderstanding'),
      q('assign_popup_info_enough', '信息优先级能区分必看、辅助参考和可忽略内容', 'productDesign'),
      q('assign_popup_layout', '弹窗布局能减少查找、对比和确认分配对象的成本', 'userExperience'),
    ],
    problemOptions: ['信息仍不够', '信息太多看不清', '筛选不好用', '分配判断帮助不大', '暂无明显问题'],
  },
  {
    name: 'AI 工作台线索管理模块',
    group: 'AI 工作台',
    description: '以会话维度承载线索全生命周期，支持查看、分配、转派、失效、平台判客等。',
    aiRelated: true,
    questions: [
      q('lead_workbench_conversation', '线索状态、责任人和下一步动作在会话内呈现清楚', 'businessUnderstanding'),
      q('lead_workbench_lifecycle', '查看、分配、转派、失效、判客的动作入口和处理顺序清楚', 'productDesign'),
      q('lead_workbench_multi_leads', '同一会话多条线索时，主线索、历史线索和待处理线索区分清楚', 'architectureDesign'),
    ],
    problemOptions: ['会话维度不直观', '日常动作不好找', '多线索状态混乱', '操作入口不顺', '暂无明显问题'],
  },
  {
    name: '线索履约：线索自动分配',
    group: '线索履约',
    description: '按城市、客服账号、分配时段和单人日上限执行，通过匹配规则和兜底机制完成自动分配。',
    aiRelated: false,
    questions: [
      q('auto_assign_efficiency', '自动分配能覆盖高频分配场景并减少人工判断', 'businessUnderstanding'),
      q('auto_assign_rule_fair', '分配依据、优先级和兜底规则对运营可解释', 'architectureDesign'),
      q('auto_assign_fallback', '未命中、冲突、异常分配等情况有明确提示和人工处理入口', 'productDesign'),
    ],
    problemOptions: ['分配规则不透明', '公平性存疑', '兜底不清楚', '人工干预不方便', '暂无明显问题'],
  },
  {
    name: '撮合流程：群聊线索跟进反馈',
    group: '撮合流程',
    description: '补齐撮合群跟进闭环，提供群列表、详情、消息总结、用户档案和跟进状态反馈。',
    aiRelated: true,
    questions: [
      q('match_daily_reminder', '每日盘点能把最需要跟进的商机优先暴露出来', 'businessUnderstanding'),
      q('match_group_detail', '列表、详情、消息总结能串起客户当前进展和跟进重点', 'productDesign'),
      q('match_summary_profile', '群消息总结和用户档案能提炼出可用于判断客户意向的信息', 'aiKnowledge'),
      q('match_feedback_loop', '跟进状态更新后，后续动作、责任人和截止时间能形成闭环', 'architectureDesign'),
    ],
    problemOptions: ['提醒价值不明显', '列表筛选不够用', '总结/档案不准确', '状态闭环不清楚', '暂无明显问题'],
  },
];

const FEEDBACK_OPTIONS = {
  朋友圈私域运营功能: {
    likeOptions: ['互动集中看', '能直接处理', '不容易漏跟进', '能区分已处理'],
    dislikeOptions: ['下一步不清楚', '入口/信息分散', '容易漏处理', '互动价值不明显'],
  },
  私聊会话自定义分组功能: {
    likeOptions: ['找会话更清楚', '能筛出重点客户', '分组逻辑可复用', '人工介入更明确'],
    dislikeOptions: ['分组条件难懂', '筛选不准', '移出规则不明', '维护成本高'],
  },
  动态策略组: {
    likeOptions: ['能分阶段管理', '减少手动调整', '目标更清楚', '适配多平台'],
    dislikeOptions: ['规则看不懂', '怕自动跑错', '配置成本高', '效果不好判断'],
  },
  '人群圈选 Skill': {
    likeOptions: ['说人话能圈人', '标签更丰富', '人群包可复用', '结果解释更清楚'],
    dislikeOptions: ['听不懂表达', '结果不可信', '标签不够', '不知道为什么选中'],
  },
  '交付群圈选 Skill': {
    likeOptions: ['选群更省事', '减少错群', '方便触达群客户', '确认方式清楚'],
    dislikeOptions: ['推荐群不准', '错漏难发现', '调整不方便', '依据看不懂'],
  },
  '私聊/群聊/朋友圈触达与内容模板 Skill': {
    likeOptions: ['模板可直接用', '触达更省时', '渠道选择方便', '城市/发送人更贴合'],
    dislikeOptions: ['模板不像人话', '渠道容易选错', '发送规则不放心', '效果难判断'],
  },
  'C 端选房师一期': {
    likeOptions: ['客户问题接得住', '回答有选房逻辑', '人工压力降低', '能覆盖常见选房问题'],
    dislikeOptions: ['回答不准', '不会转人工', '客户体验不稳', '成本收益看不清'],
  },
  'AI 有客商业化能力建设': {
    likeOptions: ['购买入口明确', '套餐展示清楚', '线索交付可追踪', '合同财务更规范'],
    dislikeOptions: ['套餐规则难懂', '购买链路断点多', '履约责任不清', '异常处理不清楚'],
  },
  线索卡片分配弹窗优化调整: {
    likeOptions: ['分配信息更全', '判断依据更明确', '筛选更方便', '标签有帮助'],
    dislikeOptions: ['信息太多', '关键信息不突出', '筛选不好用', '仍然难判断'],
  },
  'AI 工作台线索管理模块': {
    likeOptions: ['会话维度好追踪', '线索状态集中', '分配转派方便', '判客信息更清楚'],
    dislikeOptions: ['多线索容易混', '状态不好判断', '操作入口绕', '来源/标签不直观'],
  },
  '线索履约：线索自动分配': {
    likeOptions: ['减少人工分配', '分配更及时', '规则更统一', '有人工兜底'],
    dislikeOptions: ['分配原因不透明', '公平性不放心', '未命中兜底不清楚', '人工干预不方便'],
  },
  '撮合流程：群聊线索跟进反馈': {
    likeOptions: ['提醒及时', '群进展更集中', '总结有帮助', '状态更新更方便'],
    dislikeOptions: ['提醒不准', '列表筛选不够', '总结不可信', '状态闭环不清'],
  },
};

for (const feature of FEATURES) {
  Object.assign(feature, FEEDBACK_OPTIONS[feature.name] || { likeOptions: [], dislikeOptions: [] });
}

export const FEATURE_NAMES = FEATURES.map((feature) => feature.name);

export const USAGE_OPTIONS = {
  used: '用过，能评价',
  tried: '试过或看别人用过',
  heard: '听说过，但不熟',
  unknown: '不了解',
};

export const PM_DIMENSIONS = {
  businessUnderstanding: '业务理解程度',
  productDesign: '产品设计能力',
  architectureDesign: '架构与规则严谨性',
  userExperience: '用户体验能力',
  aiKnowledge: 'AI 知识深度',
};

export function validateResponse(input) {
  const errors = [];
  const profile = input?.profile || {};
  const evaluations = Array.isArray(input?.evaluations) ? input.evaluations : [];

  if (!clean(profile.role)) errors.push('请填写运营角色');
  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    errors.push('请至少评价一个你了解的功能');
  }
  for (const evaluation of evaluations) {
    const feature = findFeature(evaluation.feature);
    if (!feature) {
      errors.push('存在无法识别的功能');
      continue;
    }
    if (!USAGE_OPTIONS[evaluation.usage]) errors.push('存在无法识别的使用情况');
    const answers = evaluation.answers || {};
    for (const question of feature.questions) {
      if (!Object.prototype.hasOwnProperty.call(answers, question.id)) {
        errors.push('有功能的专属问题未完成');
        continue;
      }
      if (!isScore(answers[question.id])) errors.push('评分必须在 1-5 分之间');
    }
    if (!feature.problemOptions.includes(evaluation.mainProblem)) errors.push('存在无法识别的主要问题');
    if (!clean(evaluation.problemDetail)) errors.push(`${feature.name} 请说明最大问题的具体场景`);
    validatePointFeedback(errors, evaluation.liked, feature.likeOptions, `${feature.name} 请至少选择一个喜欢的点`);
    validatePointFeedback(errors, evaluation.disliked, feature.dislikeOptions, `${feature.name} 请至少选择一个不喜欢的点`);
    if (!clean(evaluation.liked?.detail)) errors.push(`${feature.name} 请写清楚喜欢点的具体价值`);
    if (!clean(evaluation.disliked?.detail)) errors.push(`${feature.name} 请写清楚不喜欢/想改点的具体场景`);
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

export function normalizeResponse(input, requestMeta = {}) {
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    requestMeta: normalizeRequestMeta(requestMeta),
    snapshot: normalizeSnapshot(input),
    profile: {
      role: clean(input?.profile?.role),
    },
    evaluations: (input?.evaluations || [])
      .filter((evaluation) => FEATURE_NAMES.includes(evaluation.feature))
      .map((evaluation) => ({
        feature: evaluation.feature,
        usage: USAGE_OPTIONS[evaluation.usage] ? evaluation.usage : 'unknown',
        answers: normalizeAnswers(evaluation.feature, evaluation.answers),
        mainProblem: findFeature(evaluation.feature)?.problemOptions.includes(evaluation.mainProblem)
          ? evaluation.mainProblem
          : '暂无明显问题',
        problemDetail: clean(evaluation.problemDetail),
        liked: normalizePointFeedback(evaluation.liked, findFeature(evaluation.feature)?.likeOptions),
        disliked: normalizePointFeedback(evaluation.disliked, findFeature(evaluation.feature)?.dislikeOptions),
      })),
    overall: {
      favoritePoints: clean(input?.overall?.favoritePoints),
      dislikedPoints: clean(input?.overall?.dislikedPoints),
      nextImprove: clean(input?.overall?.nextImprove),
    },
  };
}

export function summarizeResponses(responses) {
  const safeResponses = Array.isArray(responses) ? responses : [];
  const features = FEATURES.map((feature) => summarizeFeature(feature, safeResponses));
  const recommendations = [...features]
    .filter((feature) => feature.responseCount > 0)
    .sort((left, right) => left.qualityAverage - right.qualityAverage)
    .slice(0, 6);

  return {
    totalResponses: safeResponses.length,
    features,
    recommendations,
    pmSignals: summarizePmSignals(features),
    roleCounts: countValues(safeResponses.map((response) => response.profile?.role)),
    submissionStats: summarizeSubmissions(safeResponses),
    submissions: summarizeSubmissionRows(safeResponses),
    overallComments: safeResponses
      .flatMap((response) => [
        response.overall?.favoritePoints,
        response.overall?.dislikedPoints,
        response.overall?.nextImprove,
      ])
      .filter(Boolean),
    generatedAt: new Date().toISOString(),
  };
}

export async function createEmptyResponseStore(storePath = DEFAULT_STORE_PATH) {
  await mkdir(join(storePath, '..'), { recursive: true });
  await writeFile(storePath, '[]\n', 'utf8');
}

export async function readResponses(storePath = DEFAULT_STORE_PATH) {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await createEmptyResponseStore(storePath);
      return [];
    }
    throw error;
  }
}

export async function writeResponses(responses, storePath = DEFAULT_STORE_PATH) {
  await mkdir(join(storePath, '..'), { recursive: true });
  await writeFile(storePath, `${JSON.stringify(responses, null, 2)}\n`, 'utf8');
}

export async function appendResponse(response, storePath = DEFAULT_STORE_PATH) {
  const responses = await readResponses(storePath);
  responses.push(response);
  await writeResponses(responses, storePath);
  return response;
}

export function createServer({ storePath = DEFAULT_STORE_PATH, publicRoot = PUBLIC_ROOT } = {}) {
  return createHttpServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');

      if (url.pathname === '/api/config' && request.method === 'GET') {
        return sendJson(response, {
          features: FEATURES,
          featureNames: FEATURE_NAMES,
          usageOptions: USAGE_OPTIONS,
        });
      }

      if (url.pathname === '/api/admin/status' && request.method === 'GET') {
        return sendJson(response, { authenticated: isAdminAuthenticated(request) });
      }

      if (url.pathname === '/api/admin/login' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (clean(body.password) !== ADMIN_PASSWORD) {
          return sendJson(response, { ok: false, errors: ['后台密码不正确'] }, 401);
        }
        setAdminCookie(response);
        return sendJson(response, { ok: true });
      }

      if (url.pathname === '/api/responses' && request.method === 'GET') {
        if (!isAdminAuthenticated(request)) return sendUnauthorized(response);
        return sendJson(response, await readResponses(storePath));
      }

      if (url.pathname === '/api/responses' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const validation = validateResponse(body);
        if (!validation.ok) {
          return sendJson(response, { ok: false, errors: validation.errors }, 400);
        }
        const saved = await appendResponse(normalizeResponse(body, getRequestMeta(request)), storePath);
        return sendJson(response, { ok: true, response: saved }, 201);
      }

      if (url.pathname === '/api/responses' && request.method === 'DELETE') {
        if (!isAdminAuthenticated(request)) return sendUnauthorized(response);
        await writeResponses([], storePath);
        return sendJson(response, { ok: true });
      }

      if (url.pathname === '/api/summary' && request.method === 'GET') {
        if (!isAdminAuthenticated(request)) return sendUnauthorized(response);
        const responses = await readResponses(storePath);
        return sendJson(response, summarizeResponses(responses));
      }

      if (request.method !== 'GET') {
        return sendJson(response, { ok: false, errors: ['不支持的请求方式'] }, 405);
      }

      return await serveStatic(url.pathname, response, publicRoot);
    } catch (error) {
      return sendJson(response, { ok: false, errors: [error.message] }, 500);
    }
  });
}

function summarizeFeature(feature, responses) {
  const evaluations = responses.flatMap((response) =>
    (response.evaluations || []).filter((evaluation) => evaluation.feature === feature.name),
  );
  const questionSummaries = feature.questions.map((question) => ({
    ...question,
    average: average(evaluations.map((item) => item.answers?.[question.id])),
  }));
  const dimensionScores = summarizeDimensions(questionSummaries);
  const qualityAverage = average(questionSummaries.map((question) => question.average));

  return {
    ...feature,
    responseCount: evaluations.length,
    usageCounts: countValues(evaluations.map((item) => USAGE_OPTIONS[item.usage] || item.usage)),
    questionSummaries,
    dimensionScores,
    businessFitAverage: dimensionScores.businessUnderstanding,
    completenessAverage: dimensionScores.productDesign,
    rigorAverage: dimensionScores.architectureDesign,
    usabilityAverage: dimensionScores.userExperience,
    aiDepthAverage: dimensionScores.aiKnowledge,
    qualityAverage,
    topProblems: countValues(evaluations.map((item) => item.mainProblem)),
    topLikedPoints: countValues(evaluations.flatMap((item) => feedbackPoints(item.liked))),
    topDislikedPoints: countValues(evaluations.flatMap((item) => feedbackPoints(item.disliked))),
    problemComments: evaluations.map((item) => item.problemDetail).filter(Boolean),
    likedComments: evaluations.map((item) => feedbackDetail(item.liked)).filter(Boolean),
    dislikedComments: evaluations.map((item) => feedbackDetail(item.disliked)).filter(Boolean),
  };
}

function isAdminAuthenticated(request) {
  return parseCookies(headerValue(request, 'cookie')).admin_session === ADMIN_SESSION;
}

function setAdminCookie(response) {
  response.setHeader('Set-Cookie', `admin_session=${ADMIN_SESSION}; HttpOnly; SameSite=Lax; Path=/`);
}

function sendUnauthorized(response) {
  return sendJson(response, { ok: false, errors: ['请先输入后台密码'] }, 401);
}

function summarizePmSignals(features) {
  const evaluatedFeatures = features.filter((feature) => feature.responseCount > 0);
  return Object.fromEntries(
    Object.entries(PM_DIMENSIONS).map(([key, label]) => [
      key,
      {
        label,
        score: average(evaluatedFeatures.map((feature) => feature.dimensionScores[key])),
        source: '来自各功能的专属问题',
      },
    ]),
  );
}

function sendJson(response, data, statusCode = 200) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

async function serveStatic(pathname, response, publicRoot) {
  const routePath =
    pathname === '/' ? '/index.html' : pathname === '/admin' ? '/admin.html' : pathname;
  const safePath = normalize(routePath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicRoot, safePath);

  if (!filePath.startsWith(publicRoot)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  let content;
  try {
    content = await readFile(filePath);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': 'no-store',
  });
  response.end(content);
}

function contentType(filePath) {
  const ext = extname(filePath);
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.json') return 'application/json; charset=utf-8';
  if (ext === '.svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('提交内容过大'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('提交内容不是有效 JSON'));
      }
    });
    request.on('error', reject);
  });
}

function q(id, text, dimension) {
  return { id, text, dimension };
}

function findFeature(featureName) {
  return FEATURES.find((feature) => feature.name === featureName);
}

function normalizeAnswers(featureName, answers = {}) {
  const feature = findFeature(featureName);
  if (!feature) return {};
  return Object.fromEntries(
    feature.questions.map((question) => [question.id, toScore(answers[question.id])]),
  );
}

function validatePointFeedback(errors, feedback, options = [], message) {
  const points = normalizePointList(feedback?.points);
  if (points.length === 0) {
    errors.push(message);
    return;
  }
  if (points.length > 3) errors.push('喜欢/不喜欢的点最多选择 3 个');
  if (points.some((point) => point.length > 24)) errors.push('喜欢/不喜欢的自定义点最多 24 个字');
}

function normalizePointFeedback(feedback, options = []) {
  const points = normalizePointList(feedback?.points).slice(0, 3);
  return {
    points,
    detail: clean(feedback?.detail),
  };
}

function normalizePointList(points) {
  if (!Array.isArray(points)) return [];
  return [...new Set(points.map(clean).filter(Boolean))];
}

function feedbackPoints(feedback) {
  if (Array.isArray(feedback?.points)) return feedback.points;
  return [];
}

function feedbackDetail(feedback) {
  if (typeof feedback === 'string') return clean(feedback);
  return clean(feedback?.detail);
}

function summarizeDimensions(questionSummaries) {
  return Object.fromEntries(
    Object.keys(PM_DIMENSIONS).map((dimension) => [
      dimension,
      average(
        questionSummaries
          .filter((question) => question.dimension === dimension)
          .map((question) => question.average),
      ),
    ]),
  );
}

function summarizeSubmissions(responses) {
  return {
    uniqueIpCount: countValues(responses.map((response) => response.requestMeta?.ip)).length,
    topIps: countValues(responses.map((response) => response.requestMeta?.ip)).slice(0, 8),
    deviceCounts: countValues(responses.map((response) => response.requestMeta?.device)),
    browserCounts: countValues(responses.map((response) => response.requestMeta?.browser)),
  };
}

function summarizeSubmissionRows(responses) {
  return [...responses]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((response) => ({
      id: response.id,
      createdAt: response.createdAt,
      role: response.profile?.role || '',
      ip: response.requestMeta?.ip || '',
      device: response.requestMeta?.device || '',
      browser: response.requestMeta?.browser || '',
      userAgent: response.requestMeta?.userAgent || '',
      referer: response.requestMeta?.referer || '',
      evaluationCount: response.evaluations?.length || 0,
      features: (response.evaluations || []).map((evaluation) => evaluation.feature),
      snapshot: response.snapshot || {
        profile: response.profile,
        evaluations: response.evaluations,
        overall: response.overall,
      },
    }));
}

function getRequestMeta(request) {
  const forwardedFor = headerValue(request, 'x-forwarded-for');
  const ip = cleanIp(forwardedFor.split(',')[0] || headerValue(request, 'x-real-ip') || request.socket?.remoteAddress);
  const userAgent = headerValue(request, 'user-agent');
  return {
    ip,
    forwardedFor,
    userAgent,
    referer: headerValue(request, 'referer'),
    device: parseDevice(userAgent),
    browser: parseBrowser(userAgent),
  };
}

function normalizeRequestMeta(meta = {}) {
  return {
    ip: clean(meta.ip),
    forwardedFor: clean(meta.forwardedFor),
    userAgent: clean(meta.userAgent),
    referer: clean(meta.referer),
    device: clean(meta.device) || parseDevice(meta.userAgent),
    browser: clean(meta.browser) || parseBrowser(meta.userAgent),
  };
}

function normalizeSnapshot(input) {
  return limitSnapshot({
    profile: input?.profile || {},
    evaluations: Array.isArray(input?.evaluations) ? input.evaluations : [],
    overall: input?.overall || {},
  });
}

function limitSnapshot(value, depth = 0) {
  if (depth > 6) return '[内容层级过深]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value.length > 1200 ? `${value.slice(0, 1200)}...` : value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => limitSnapshot(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 60)
        .map(([key, item]) => [key, limitSnapshot(item, depth + 1)]),
    );
  }
  return String(value);
}

function headerValue(request, name) {
  const value = request.headers?.[name];
  return Array.isArray(value) ? value.join(', ') : clean(value);
}

function parseCookies(cookieHeader = '') {
  return String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf('=');
      if (index < 0) return cookies;
      cookies[decodeURIComponent(part.slice(0, index))] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function cleanIp(value) {
  return clean(value).replace(/^::ffff:/, '') || 'unknown';
}

function parseDevice(userAgent = '') {
  const ua = String(userAgent).toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'Tablet';
  if (/mobile|iphone|android/.test(ua)) return 'Mobile';
  if (ua) return 'Desktop';
  return 'Unknown';
}

function parseBrowser(userAgent = '') {
  const ua = String(userAgent);
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari';
  return ua ? 'Other' : 'Unknown';
}

function isScore(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 5;
}

function toScore(value) {
  return isScore(value) ? Number(value) : null;
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (valid.length === 0) return null;
  return Math.round((valid.reduce((sum, value) => sum + value, 0) / valid.length) * 10) / 10;
}

function countValues(values) {
  const counts = new Map();
  for (const value of values || []) {
    const label = clean(value);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function clean(value) {
  return String(value || '').trim();
}

if (
  typeof process !== 'undefined' &&
  process.argv?.[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const port = Number(process.env.PORT || 5177);
  const server = createServer();
  server.listen(port, () => {
    console.log(`运营功能调研应用已启动：http://localhost:${port}`);
    console.log(`后台地址：http://localhost:${port}/admin`);
  });
}
