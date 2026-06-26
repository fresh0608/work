import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  FEATURES,
  FEATURE_NAMES,
  createEmptyResponseStore,
  createServer,
  normalizeResponse,
  summarizeResponses,
  validateResponse,
} from '../server.js';

const momentsQuestionIds = FEATURES[0].questions.map((question) => question.id);
const strategyQuestionIds = FEATURES[2].questions.map((question) => question.id);

assert.equal(FEATURES.every((feature) => feature.likeOptions.length > 0), true);
assert.equal(FEATURES.every((feature) => feature.dislikeOptions.length > 0), true);

const sampleResponse = {
  profile: {
    role: '私域运营',
  },
  evaluations: [
    {
      feature: FEATURE_NAMES[0],
      usage: 'used',
      answers: {
        [momentsQuestionIds[0]]: 5,
        [momentsQuestionIds[1]]: 4,
        [momentsQuestionIds[2]]: 3,
      },
      mainProblem: FEATURES[0].problemOptions[0],
      problemDetail: '互动处理动作和后续跟进关系需要更明确。',
      liked: {
        points: [FEATURES[0].likeOptions[0], '我自己写的喜欢点'],
        detail: '客户点赞评论能集中看到。',
      },
      disliked: {
        points: [FEATURES[0].dislikeOptions[0]],
        detail: '标记已处理和私聊触达的关系还不够直观。',
      },
    },
    {
      feature: FEATURE_NAMES[2],
      usage: 'used',
      answers: {
        [strategyQuestionIds[0]]: 4,
        [strategyQuestionIds[1]]: 2,
        [strategyQuestionIds[2]]: 2,
      },
      mainProblem: FEATURES[2].problemOptions[1],
      problemDetail: '阶段切换规则解释不足，运营很难判断策略是否按预期执行。',
      liked: {
        points: [FEATURES[2].likeOptions[0]],
        detail: '多阶段策略组方向是对的。',
      },
      disliked: {
        points: [FEATURES[2].dislikeOptions[0], FEATURES[2].dislikeOptions[1]],
        detail: '不知道什么时候会切换到下一阶段。',
      },
    },
  ],
  overall: {
    favoritePoints: '朋友圈互动闭环、线索管理会话维度比较好。',
    dislikedPoints: '动态策略组规则解释不够直观。',
    nextImprove: '先把自动流转规则解释清楚。',
  },
};

const validation = validateResponse(sampleResponse);
assert.equal(validation.ok, true);

const invalid = validateResponse({
  profile: { role: '' },
  evaluations: [
    {
      feature: FEATURE_NAMES[0],
      usage: 'used',
      answers: {
        [momentsQuestionIds[0]]: 6,
      },
      mainProblem: FEATURES[0].problemOptions[0],
      problemDetail: '',
      liked: { points: [], detail: '' },
      disliked: { points: [], detail: '' },
    },
  ],
});
assert.equal(invalid.ok, false);
assert.equal(invalid.errors.includes('请填写运营角色'), true);
assert.equal(invalid.errors.includes('评分必须在 1-5 分之间'), true);
assert.equal(invalid.errors.includes('有功能的专属问题未完成'), true);
assert.equal(invalid.errors.includes(`${FEATURES[0].name} 请说明最大问题的具体场景`), true);
assert.equal(invalid.errors.includes(`${FEATURES[0].name} 请至少选择一个喜欢的点`), true);
assert.equal(invalid.errors.includes(`${FEATURES[0].name} 请至少选择一个不喜欢的点`), true);

const singleEvaluation = validateResponse({
  ...sampleResponse,
  evaluations: [sampleResponse.evaluations[0]],
});
assert.equal(singleEvaluation.ok, true);

const extraEvaluation = (featureIndex) => ({
  feature: FEATURE_NAMES[featureIndex],
  usage: 'used',
  answers: Object.fromEntries(FEATURES[featureIndex].questions.map((question) => [question.id, 4])),
  mainProblem: FEATURES[featureIndex].problemOptions[0],
  problemDetail: '这里补充一个具体场景，说明最大问题为什么影响运营判断。',
  liked: { points: [FEATURES[featureIndex].likeOptions[0]], detail: '这个点能让运营更快判断下一步。' },
  disliked: { points: [FEATURES[featureIndex].dislikeOptions[0]], detail: '这个点会让运营不确定规则边界。' },
});

const manyEvaluations = validateResponse({
  ...sampleResponse,
  evaluations: [
    ...sampleResponse.evaluations,
    extraEvaluation(3),
    extraEvaluation(4),
    extraEvaluation(5),
  ],
});
assert.equal(manyEvaluations.ok, true);

const normalized = normalizeResponse(sampleResponse, {
  ip: '203.0.113.8',
  userAgent: 'Mozilla/5.0 Chrome/120.0',
  referer: 'https://example.com/survey',
});
assert.equal(normalized.profile.role, '私域运营');
assert.equal(normalized.requestMeta.ip, '203.0.113.8');
assert.equal(normalized.requestMeta.browser, 'Chrome');
assert.equal(normalized.snapshot.evaluations.length, 2);
assert.equal(normalized.evaluations.length, 2);
assert.equal(normalized.evaluations[0].answers[momentsQuestionIds[0]], 5);
assert.deepEqual(normalized.evaluations[0].liked.points, [
  FEATURES[0].likeOptions[0],
  '我自己写的喜欢点',
]);
assert.equal(normalized.evaluations[1].disliked.detail, '不知道什么时候会切换到下一阶段。');
assert.equal(normalized.id.length > 8, true);

const summary = summarizeResponses([normalized]);
assert.equal(summary.totalResponses, 1);
assert.equal(summary.features.length, FEATURE_NAMES.length);
assert.equal(summary.submissionStats.uniqueIpCount, 1);
assert.equal(summary.submissions[0].ip, '203.0.113.8');
assert.equal(summary.submissions[0].snapshot.evaluations.length, 2);

const moments = summary.features.find((feature) => feature.name === FEATURE_NAMES[0]);
assert.equal(moments.responseCount, 1);
assert.equal(moments.questionSummaries.length, FEATURES[0].questions.length);
assert.equal(moments.questionSummaries[0].average, 5);
assert.equal(moments.qualityAverage, 4);
assert.equal(moments.problemComments[0], '互动处理动作和后续跟进关系需要更明确。');
assert.equal(moments.likedComments[0], '客户点赞评论能集中看到。');
assert.equal(moments.dislikedComments[0], '标记已处理和私聊触达的关系还不够直观。');
assert.equal(moments.topLikedPoints[0].label, FEATURES[0].likeOptions[0]);
assert.equal(moments.topLikedPoints.some((item) => item.label === '我自己写的喜欢点'), true);
assert.equal(moments.topDislikedPoints[0].label, FEATURES[0].dislikeOptions[0]);

const strategy = summary.features.find((feature) => feature.name === FEATURE_NAMES[2]);
assert.equal(strategy.qualityAverage, 2.7);
assert.equal(strategy.topProblems[0].label, FEATURES[2].problemOptions[1]);

assert.equal(summary.pmSignals.businessUnderstanding.score, 4.5);
assert.equal(summary.pmSignals.architectureDesign.score, 3);
assert.equal(summary.pmSignals.userExperience.score, 2.5);

const appJs = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const stylesCss = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const indexHtml = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const adminHtml = await readFile(new URL('../public/admin.html', import.meta.url), 'utf8');
assert.equal(appJs.includes('function renderEvaluationWorkspace'), true);
assert.equal(appJs.includes('id="evaluationWorkspace"'), true);
assert.equal(appJs.includes('class="score-panel" hidden'), false);
assert.equal(appJs.includes('MAX_EVALUATIONS'), false);
assert.equal(appJs.includes('data-action="start-evaluation"'), true);
assert.equal(appJs.includes('data-problem-detail'), true);
assert.equal(appJs.includes('const WORKSPACE_STEPS'), true);
assert.equal(appJs.includes('function renderStepNav'), true);
assert.equal(appJs.includes('function renderActiveStep'), true);
assert.equal(appJs.includes('data-step-panel'), true);
assert.equal(stylesCss.includes('.step-shell'), true);
assert.equal(stylesCss.includes('.choice-cloud'), true);
assert.equal(indexHtml.includes('href="/admin"'), false);
assert.equal(indexHtml.includes('查看后台'), false);
assert.equal(indexHtml.includes('overall-feedback-flow'), true);
assert.equal(indexHtml.includes('class="large-feedback"'), true);
assert.equal(indexHtml.includes('grid-3">\n            <div class="field">\n              <label for="favoritePoints"'), false);
assert.equal(adminHtml.includes('snapshotTable'), true);
assert.equal(adminHtml.includes('adminLoginForm'), true);

const tempDir = await mkdtemp(join(tmpdir(), 'operator-survey-'));
try {
  const storePath = join(tempDir, 'responses.json');
  await createEmptyResponseStore(storePath);
  const server = createServer({ storePath });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const configResult = await fetch(`${baseUrl}/api/config`);
  assert.equal(configResult.status, 200);
  const config = await configResult.json();
  assert.equal(config.features[0].questions.length >= 3, true);
  assert.equal(config.features[0].likeOptions.length > 0, true);
  assert.equal(config.features[0].questions[0].text.includes('完整'), false);
  assert.equal(config.features[0].questions[0].text.includes('讲清楚'), false);
  assert.equal(config.roles, undefined);
  assert.equal(config.frequencies, undefined);

  const postResult = await fetch(`${baseUrl}/api/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': '198.51.100.22',
      'User-Agent': 'Mozilla/5.0 Edg/120.0',
    },
    body: JSON.stringify(sampleResponse),
  });
  assert.equal(postResult.status, 201);

  const summaryResult = await fetch(`${baseUrl}/api/summary`);
  assert.equal(summaryResult.status, 401);

  const loginResult = await fetch(`${baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin123' }),
  });
  assert.equal(loginResult.status, 200);
  const cookie = loginResult.headers.get('set-cookie');
  assert.equal(cookie.includes('admin_session='), true);

  const authedSummaryResult = await fetch(`${baseUrl}/api/summary`, {
    headers: { Cookie: cookie },
  });
  assert.equal(authedSummaryResult.status, 200);
  const liveSummary = await authedSummaryResult.json();
  assert.equal(liveSummary.totalResponses, 1);
  assert.equal(liveSummary.features[0].topLikedPoints.length > 0, true);
  assert.equal(liveSummary.submissionStats.uniqueIpCount, 1);
  assert.equal(liveSummary.submissions[0].ip, '198.51.100.22');
  assert.equal(liveSummary.submissions[0].browser, 'Edge');

  await new Promise((resolve) => server.close(resolve));
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
